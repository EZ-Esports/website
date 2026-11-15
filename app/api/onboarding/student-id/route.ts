import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { findInviteByTokenHash } from '@/app/lib/db/onboarding';
import { deleteUploadRowByKey, replacePendingUpload } from '@/app/lib/db/student-ids';
import { getClientIp, rateLimit } from '@/app/lib/rate-limit';
import {
  STUDENT_ID_MAX_BODY_BYTES,
  STUDENT_ID_TOO_LARGE_MESSAGE,
  buildStudentIdStorageKey,
  validateStudentIdBytes,
} from '@/app/lib/onboarding/student-id';
import { putStudentId, removeStudentIds } from '@/app/lib/onboarding/student-id-storage';
import { sweepOrphanStudentIds } from '@/app/lib/onboarding/student-id-sweep';

const noStore = { 'Cache-Control': 'private, no-store' };

const UPLOAD_LIMIT = 10;
const UPLOAD_WINDOW_MS = 10 * 60_000;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: noStore });

/**
 * Receives the student ID photo during onboarding (spec-056).
 *
 * The browser sends only the invite token and the file. Everything else is decided here: the invite
 * must be pending and unexpired, the type comes from the file's magic bytes, and the object key is a
 * fresh random UUID. The upload is recorded against the invite in `student_id_uploads`; the final
 * submission looks it up by invite, so the browser never names (and can never swap in) a key.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = rateLimit(`student-id:${ip}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a few minutes and try again.' },
      { status: 429, headers: { ...noStore, 'Retry-After': String(Math.ceil(limited.resetInMs / 1000)) } }
    );
  }

  // Refuse oversized bodies from the declared length before buffering them.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > STUDENT_ID_MAX_BODY_BYTES) return fail(STUDENT_ID_TOO_LARGE_MESSAGE, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Invalid upload.');
  }

  const token = form.get('token');
  const file = form.get('file');
  if (typeof token !== 'string' || !token.trim()) return fail('Invalid or non-existent invite link.', 404);
  if (!(file instanceof File)) return fail('Please choose a photo of your student ID.');

  const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
  const found = await findInviteByTokenHash(tokenHash);
  if (!found) return fail('Invalid or non-existent invite link.', 404);
  const { kind, invite } = found;
  if (invite.status !== 'pending') return fail('This invite can no longer accept uploads.', 409);
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return fail('Invite link has expired.', 410);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateStudentIdBytes(bytes);
  if (!checked.ok) return fail(checked.error);

  const storageKey = buildStudentIdStorageKey(randomUUID(), checked.type);
  const { error: uploadError, bucketMissing } = await putStudentId(storageKey, bytes, checked.type);
  if (uploadError) {
    if (bucketMissing) {
      // Already logged with the fix. Tell the student something actionable instead of "try again".
      return fail('Photo uploads are not available right now. Please contact EZ Esports so we can fix it, then try again.', 503);
    }
    console.error('Failed to store student ID:', uploadError);
    return fail('Could not save your photo. Please try again.', 500);
  }

  try {
    await replacePendingUpload(kind, invite.id, {
      storageKey,
      contentType: checked.type,
      sizeBytes: bytes.length,
    });
    // An earlier photo for this same invite was demoted to an orphan row; the sweep below removes its
    // object and keeps the row for a retry if Storage refuses.
  } catch (err) {
    console.error('Failed to record student ID upload:', err instanceof Error ? err.message : 'unexpected error');
    // No row points at the object, so remove it rather than leave an unowned ID photo around.
    await deleteUploadRowByKey(storageKey).catch(() => undefined);
    await removeStudentIds([storageKey]);
    return fail('Could not save your photo. Please try again.', 500);
  }

  // Opportunistic cleanup of photos whose invite expired or was deleted. Never throws.
  await sweepOrphanStudentIds();

  return NextResponse.json({ success: true }, { status: 201, headers: noStore });
}
