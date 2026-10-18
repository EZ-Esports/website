import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { uploadToStorage, STORAGE_CACHE_CONTROL } from '@/app/lib/storage';
import { buildHandbookStorageKey, validateHandbookUpload } from '@/app/lib/handbook';

// Staff-only and rare; the cap just stops a runaway script from filling Storage.
const UPLOAD_LIMIT = 10;
const UPLOAD_WINDOW_MS = 60_000;

/**
 * Stores a new handbook PDF in public storage and returns its key. The object
 * only becomes the live handbook once `saveHandbookPdf` records the key, so a
 * failed save leaves the previous handbook untouched.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`handbook-upload:${getClientIp(req)}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    );
  }

  try {
    await requirePermission(Permissions.MANAGE_CONTENT);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const invalid = validateHandbookUpload(file, new Uint8Array(arrayBuffer));
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const storageKey = buildHandbookStorageKey();
  const { error, publicUrl } = await uploadToStorage(storageKey, arrayBuffer, {
    contentType: 'application/pdf',
    upsert: false,
    cacheControl: STORAGE_CACHE_CONTROL,
  });
  if (error) {
    console.error('Handbook upload failed:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl, storageKey }, { status: 201 });
}
