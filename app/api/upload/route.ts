import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';
import { requirePermission } from '@/app/lib/auth';
import {
  SECTION_PERMISSIONS,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  MAX_FILE_SIZE_BYTES,
  STORAGE_CACHE_CONTROL,
  deriveThumbnailKey,
  isValidSection,
  sanitizeEntityId,
  buildStorageKey,
  uploadToStorage,
  removeFromStorage,
} from '@/app/lib/storage';
import { generateThumbnail, inspectImage, ImageInputError, type ThumbnailResult } from '@/app/lib/image-thumbnail';

// Authorized staff uploading images: 30 uploads per minute is a generous cap
// that prevents accidental runaway scripts from exhausting Supabase Storage.
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`upload:${ip}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const rawSection = formData.get('section');
  if (!isValidSection(rawSection)) {
    return NextResponse.json(
      { error: 'Invalid or missing section. Allowed: gallery, schools, sponsors, leadership' },
      { status: 400 },
    );
  }
  const section = rawSection;

  try {
    await requirePermission(SECTION_PERMISSIONS[section]);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rawEntityId = formData.get('entityId');
  const entityId = typeof rawEntityId === 'string' ? sanitizeEntityId(rawEntityId) : null;
  if (!entityId) {
    return NextResponse.json(
      { error: 'Invalid or missing entityId. Path traversal and special characters are forbidden.' },
      { status: 400 },
    );
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // SVG is intentionally excluded: it can carry inline <script>, and files land
  // in a public bucket served with their own content-type (stored-XSS vector).
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 5 MB.' },
      { status: 400 },
    );
  }

  const ext = MIME_TO_EXT[file.type];
  const storageKey = buildStorageKey(section, entityId, ext);
  const arrayBuffer = await file.arrayBuffer();

  // The declared MIME type is client-controlled, so the bytes are inspected before
  // anything is written: the decoded format must be on the allowlist and the pixel
  // count bounded. Gallery photos additionally get a small thumbnail so grids and
  // the marquee never download the full-size file.
  let thumbnail: ThumbnailResult | null = null;
  try {
    if (section === 'gallery') {
      thumbnail = await generateThumbnail(arrayBuffer);
    } else {
      await inspectImage(arrayBuffer);
    }
  } catch (err) {
    if (err instanceof ImageInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Image validation failed:', err);
    return NextResponse.json({ error: 'Could not read that image. Try a different file.' }, { status: 400 });
  }

  // Use secret key for storage via uploadToStorage helper with Cache-Control: 31536000
  const { error: uploadError, publicUrl } = await uploadToStorage(storageKey, arrayBuffer, {
    contentType: file.type,
    upsert: false,
    cacheControl: STORAGE_CACHE_CONTROL,
  });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  let thumbnailUrl: string | null = null;
  let thumbnailStorageKey: string | null = null;

  if (thumbnail && !thumbnail.skipped) {
    const thumbKey = deriveThumbnailKey(storageKey);
    const { error: thumbError, publicUrl: thumbPublicUrl } = await uploadToStorage(thumbKey, thumbnail.buffer, {
      contentType: thumbnail.mime,
      upsert: false,
      cacheControl: STORAGE_CACHE_CONTROL,
    });

    if (thumbError) {
      // Keep the pair atomic: a full-size photo without its thumbnail would silently
      // send every grid view back to the heavy file, so undo the first object.
      console.error('Thumbnail upload failed:', thumbError);
      const rollback = await removeFromStorage([storageKey]);
      if (rollback.error) console.error('Rollback of full-size upload failed:', rollback.error);
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }

    thumbnailUrl = thumbPublicUrl;
    thumbnailStorageKey = thumbKey;
  }

  return NextResponse.json({ url: publicUrl, storageKey, thumbnailUrl, thumbnailStorageKey }, { status: 201 });
}
