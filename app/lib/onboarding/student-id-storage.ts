import 'server-only';
import { createServiceClient } from '@/app/lib/supabase/service';
import { STUDENT_ID_BUCKET, STUDENT_ID_SIGNED_URL_TTL_SECONDS, isStudentIdStorageKey } from './student-id';
import { localPut, localRead, localRemove, resolveStudentIdDriver } from './student-id-local';

/**
 * Server-only access to the private `student-ids` bucket (spec-056), always through the service-role
 * client. There is deliberately no `getPublicUrl` here: the bucket is private and the only read path is
 * a short-lived signed URL created for an authorized staff member.
 *
 * Every function first asks `resolveStudentIdDriver()`. That is `bucket` (this code) unless
 * STUDENT_ID_STORAGE=local, which the guards in student-id-local.ts only allow on a developer machine
 * (not production, loopback database, directory configured) and otherwise turn into an error.
 */

/** True when the dev-only local driver is active (throws if it was requested but a guard fails). */
export function isLocalStudentIdStorage(): boolean {
  return resolveStudentIdDriver().driver === 'local';
}

export async function putStudentId(
  key: string,
  bytes: Uint8Array,
  contentType: string
): Promise<{ error: string | null; bucketMissing?: boolean }> {
  if (!isStudentIdStorageKey(key)) return { error: 'invalid key' };
  const chosen = resolveStudentIdDriver();
  if (chosen.driver === 'local') return localPut(chosen.dir!, key, bytes);
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
  const chosen = resolveStudentIdDriver();
  if (chosen.driver === 'local') return localRemove(chosen.dir!, valid);
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
  // The local driver has no URLs: staff are served the bytes by the route (see readLocalStudentId).
  if (resolveStudentIdDriver().driver === 'local') return null;
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

/** Local driver only: the stored bytes and verified content type, or null. Callers must already have authorized the viewer. */
export async function readLocalStudentId(
  key: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const chosen = resolveStudentIdDriver();
  if (chosen.driver !== 'local') return null;
  return localRead(chosen.dir!, key);
}
