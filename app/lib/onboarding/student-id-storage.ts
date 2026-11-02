import 'server-only';
import { createServiceClient } from '@/app/lib/supabase/service';
import { STUDENT_ID_BUCKET, STUDENT_ID_SIGNED_URL_TTL_SECONDS, isStudentIdStorageKey } from './student-id';

/**
 * Server-only access to the private `student-ids` bucket (spec-056), always through the service-role
 * client. There is deliberately no `getPublicUrl` here: the bucket is private and the only read path is
 * a short-lived signed URL created for an authorized staff member.
 */

export async function putStudentId(
  key: string,
  bytes: Uint8Array,
  contentType: string
): Promise<{ error: string | null; bucketMissing?: boolean }> {
  if (!isStudentIdStorageKey(key)) return { error: 'invalid key' };
  const { error } = await createServiceClient()
    .storage.from(STUDENT_ID_BUCKET)
    // The detected type, never the client's header. No long cache-control: this is private data.
    .upload(key, bytes, { contentType, upsert: false, cacheControl: '0' });
  if (error && isBucketMissing(error)) {
    console.error(
      `Student ID upload failed: the private Storage bucket "${STUDENT_ID_BUCKET}" does not exist. ` +
        'Create it (Public OFF, 5 MB, image/jpeg, image/png, image/webp) before accepting onboarding submissions.'
    );
    return { error: error.message, bucketMissing: true };
  }
  return { error: error ? error.message : null };
}

/** Supabase answers 404 / "Bucket not found" when the bucket was never created. */
function isBucketMissing(error: { message?: string; statusCode?: string | number; status?: number }): boolean {
  return /bucket not found/i.test(error.message ?? '') || String(error.statusCode ?? error.status ?? '') === '404';
}

/**
 * Best-effort removal of objects by key. Keys come from our own table, never the browser; anything not
 * shaped like our keys is ignored. Failures are logged (no key values) and never thrown, so a storage
 * hiccup cannot turn a successful delete or submit into an error. Returns whether Storage accepted the removal.
 */
export async function removeStudentIds(keys: Array<string | null | undefined>): Promise<boolean> {
  const valid = keys.filter(isStudentIdStorageKey);
  if (valid.length === 0) return true;
  try {
    const { error } = await createServiceClient().storage.from(STUDENT_ID_BUCKET).remove(valid);
    if (error) console.error('Could not remove student ID objects:', error.message);
    return !error;
  } catch (err) {
    console.error('Could not remove student ID objects:', err instanceof Error ? err.message : 'unexpected error');
    return false;
  }
}

/** A signed URL that expires in `STUDENT_ID_SIGNED_URL_TTL_SECONDS`. Callers must already have authorized the viewer. */
export async function signStudentIdUrl(key: string): Promise<string | null> {
  if (!isStudentIdStorageKey(key)) return null;
  const { data, error } = await createServiceClient()
    .storage.from(STUDENT_ID_BUCKET)
    .createSignedUrl(key, STUDENT_ID_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error(
      /bucket not found/i.test(error?.message ?? '')
        ? `Failed to sign student ID URL: the private Storage bucket "${STUDENT_ID_BUCKET}" does not exist; create it.`
        : `Failed to sign student ID URL: ${error?.message}`
    );
    return null;
  }
  return data.signedUrl;
}
