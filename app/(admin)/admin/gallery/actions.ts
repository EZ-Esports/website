'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath, updateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { cleanupEntityStorage, isKeyScopedToEntity, sanitizeEntityId } from '@/app/lib/storage';
import { ActionError } from '@/app/lib/errors';
import { resolveGalleryThumbnail, validateGalleryImageSrc } from '@/app/lib/gallery-thumbnails';
import {
  getGalleryImageStoredFields,
  insertGalleryImage,
  reorderGalleryImages,
  setGalleryImageActive,
  softDeleteGalleryImage,
  updateGalleryImageRow,
} from '@/app/lib/db/gallery';

export async function addGalleryImage(formData: FormData) {
  await requirePermission(Permissions.MANAGE_GALLERY);
  const src = formData.get('src') as string;
  const caption = (formData.get('caption') as string) ?? '';
  const schoolName = (formData.get('schoolName') as string) ?? '';
  const eventName = (formData.get('eventName') as string) ?? '';
  const rawEntityId = (formData.get('entityId') || formData.get('id')) as string | null;
  const entityId = sanitizeEntityId(rawEntityId);

  const rawStorageKey = (formData.get('storageKey') as string) || null;
  const storageKey = entityId && isKeyScopedToEntity(rawStorageKey, 'gallery', entityId) ? rawStorageKey : null;

  const thumb = resolveGalleryThumbnail({
    src,
    entityId,
    storageKey,
    rawThumbnailKey: (formData.get('thumbnailStorageKey') as string) || null,
  });

  if (!src) return { success: false, error: 'Please upload an image first.' };
  if (!caption) return { success: false, error: 'A caption (used as alt text) is required.' };
  const srcError = validateGalleryImageSrc({ src, storageKey });
  if (srcError) return { success: false, error: srcError };

  try {
    await insertGalleryImage({ id: entityId, src, caption, schoolName, eventName, storageKey, thumb });

    if (entityId) {
      await cleanupEntityStorage('gallery', entityId, [storageKey, thumb.thumbnailStorageKey]);
    }
  } catch (error) {
    console.error('Failed to add gallery image', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  updateTag('gallery-images');
  revalidatePath('/admin/gallery');
  revalidatePath('/');
  return { success: true };
}

export async function updateGalleryImage(id: string, formData: FormData) {
  await requirePermission(Permissions.MANAGE_GALLERY);
  const src = formData.get('src') as string;
  const caption = (formData.get('caption') as string) ?? '';
  const schoolName = (formData.get('schoolName') as string) ?? '';
  const eventName = (formData.get('eventName') as string) ?? '';
  const rawStorageKey = (formData.get('storageKey') as string) || null;

  if (!src) return { success: false, error: 'An image is required.' };
  if (!caption) return { success: false, error: 'A caption (used as alt text) is required.' };

  try {
    const old = await getGalleryImageStoredFields(id);

    // Only accept storage keys strictly scoped to this entity folder
    const validNewStorageKey = isKeyScopedToEntity(rawStorageKey, 'gallery', id) ? rawStorageKey : null;
    const storageKey = validNewStorageKey ?? (rawStorageKey === '' ? null : (old?.storageKey && isKeyScopedToEntity(old.storageKey, 'gallery', id) ? old.storageKey : null));

    const srcError = validateGalleryImageSrc({ src, storageKey, existingSrc: old?.src });
    if (srcError) return { success: false, error: srcError };

    const thumb = resolveGalleryThumbnail({
      src,
      entityId: id,
      storageKey,
      rawThumbnailKey: (formData.get('thumbnailStorageKey') as string) || null,
      existing: old,
    });

    // Scope cleanup strictly to this entity folder, preserving the active full-size
    // and thumbnail keys; a replaced photo's old pair is removed together.
    await cleanupEntityStorage('gallery', id, [storageKey, thumb.thumbnailStorageKey]);

    await updateGalleryImageRow(id, { src, caption, schoolName, eventName, storageKey }, thumb);
  } catch (error) {
    console.error('Failed to update gallery image', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  updateTag('gallery-images');
  revalidatePath('/admin/gallery');
  revalidatePath('/');
  return { success: true };
}

/**
 * Persists a full reorder in one shot: the incoming array must contain the
 * exact set of non-deleted gallery image IDs, with no duplicates or missing IDs.
 * The advisory lock serializes concurrent reorders and additions.
 */
export async function updateGalleryImagesOrder(orderedIds: string[]) {
  await requirePermission(Permissions.MANAGE_GALLERY);

  if (!Array.isArray(orderedIds)) {
    return { success: false, error: 'Invalid payload: orderedIds must be an array.' };
  }

  try {
    await reorderGalleryImages(orderedIds);
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message };
    }
    console.error('Failed to reorder gallery images', error);
    return { success: false, error: 'Could not update order. Please try again.' };
  }

  updateTag('gallery-images');
  revalidatePath('/admin/gallery');
  revalidatePath('/');
  return { success: true };
}

export async function toggleGalleryImageActive(id: string, isActive: boolean) {
  await requirePermission(Permissions.MANAGE_GALLERY);
  try {
    await setGalleryImageActive(id, isActive);
  } catch (error) {
    console.error('Failed to toggle gallery image active state', error);
    return { success: false, error: 'Could not update status. Please try again.' };
  }

  updateTag('gallery-images');
  revalidatePath('/admin/gallery');
  revalidatePath('/');
  return { success: true };
}

export async function deleteGalleryImage(id: string) {
  const user = await requirePermission(Permissions.MANAGE_GALLERY);

  await softDeleteGalleryImage(id, user.id);

  // Scope cleanup strictly to that entity's folder in Supabase Storage
  await cleanupEntityStorage('gallery', id);

  updateTag('gallery-images');
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}
