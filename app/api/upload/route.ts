import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';
import { requirePermission } from '@/app/lib/auth';
import {
  BUCKET,
  SECTION_PERMISSIONS,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  MAX_FILE_SIZE_BYTES,
  isValidSection,
  sanitizeEntityId,
  buildStorageKey,
} from '@/app/lib/storage';

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

  // Use secret key for storage to bypass RLS — safe because auth is already verified above
  const supabaseStorage = createServiceClient();

  const { error: uploadError } = await supabaseStorage.storage
    .from(BUCKET)
    .upload(storageKey, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseStorage.storage
    .from(BUCKET)
    .getPublicUrl(storageKey);

  return NextResponse.json({ url: publicUrl, storageKey }, { status: 201 });
}
