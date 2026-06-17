import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';
import { getAdmin } from '@/app/lib/auth';

const BUCKET = 'admin-uploads';
// Authenticated admins uploading images: 30 uploads per minute is a generous cap
// that prevents accidental runaway scripts from exhausting Supabase Storage.
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  // Enforce admin authorization: session must exist AND be on the admin allowlist.
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`upload:${ip}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please slow down and try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    );
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // SVG is intentionally excluded: it can carry inline <script>, and files land
  // in a public bucket served with their own content-type (stored-XSS vector).
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 5 MB.' },
      { status: 400 }
    );
  }

  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const ext = mimeToExt[file.type];
  const storageKey = `${crypto.randomUUID()}.${ext}`;
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
