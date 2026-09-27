import 'server-only';
import { createServiceClient } from '@/app/lib/supabase/service';
import {
  BUCKET,
  STORAGE_CACHE_CONTROL,
  sanitizeEntityId,
  type UploadSection,
  type StorageUploadOptions,
} from './storage-constants';

export * from './storage-constants';

/**
 * Uploads a file buffer to Supabase Storage with optimal cache-control headers.
 * Sets Cache-Control max-age=31536000 by default so edge CDNs and browsers cache immutable assets.
 */
export async function uploadToStorage(
  storageKey: string,
  data: ArrayBuffer | Buffer,
  options?: StorageUploadOptions,
) {
  const supabase = createServiceClient();
  const cacheControl = options?.cacheControl ?? STORAGE_CACHE_CONTROL;
  const result = await supabase.storage.from(BUCKET).upload(storageKey, data, {
    contentType: options?.contentType,
    upsert: options?.upsert ?? false,
    cacheControl,
  });

  if (result.error) {
    return { data: null, error: result.error, publicUrl: null };
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
  return { data: result.data, error: null, publicUrl };
}

/**
 * Scopes cleanup strictly to an entity's storage folder `${section}/${entityId}/`.
 * Ignores client-supplied delete keys and only removes objects inside this entity folder,
 * optionally preserving a specific active key (e.g., during replacement).
 */
export async function cleanupEntityStorage(
  section: UploadSection,
  entityId: string | null | undefined,
  keepStorageKey?: string | null,
): Promise<{ deleted: string[]; error?: string }> {
  const safeId = sanitizeEntityId(entityId);
  if (!safeId) return { deleted: [] };

  const folder = `${section}/${safeId}`;
  try {
    const supabase = createServiceClient();
    const { data: files, error } = await supabase.storage.from(BUCKET).list(folder);
    if (error) {
      console.error(`Failed to list storage folder ${folder}:`, error);
      return { deleted: [], error: error.message };
    }

    if (!files || files.length === 0) {
      return { deleted: [] };
    }

    const filesToRemove = files
      .filter((file) => {
        if (!file.name) return false;
        const fullKey = `${folder}/${file.name}`;
        return !keepStorageKey || fullKey !== keepStorageKey;
      })
      .map((file) => `${folder}/${file.name}`);

    if (filesToRemove.length === 0) {
      return { deleted: [] };
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove(filesToRemove);
    if (removeError) {
      console.error(`Failed to remove storage files in ${folder}:`, removeError);
      return { deleted: [], error: removeError.message };
    }

    return { deleted: filesToRemove };
  } catch (err) {
    console.error(`Unexpected error during storage cleanup in ${folder}:`, err);
    return { deleted: [], error: err instanceof Error ? err.message : String(err) };
  }
}
