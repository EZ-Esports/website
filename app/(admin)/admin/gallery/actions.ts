'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { cleanupEntityStorage, isKeyScopedToEntity, sanitizeEntityId } from '@/app/lib/storage';
import { ActionError } from '@/app/lib/errors';

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

  if (!src) return { success: false, error: 'Please upload an image first.' };
  if (!caption) return { success: false, error: 'A caption (used as alt text) is required.' };

  try {
    // New images always go to the end of the list — display order is derived, never user-entered.
    // The advisory lock serializes concurrent adds so two simultaneous submissions can't both
    // read the same max() and insert duplicate displayOrder values (it's tied to the transaction,
    // so it's safe under Supabase's transaction pooler, unlike a session-level advisory lock).
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gallery_images_display_order'))`);

      const [maxOrderResult] = await tx
        .select({ maxOrder: sql<number>`max(${schema.galleryImages.displayOrder})` })
        .from(schema.galleryImages)
        .where(isNull(schema.galleryImages.deletedAt));

      const displayOrder = (maxOrderResult?.maxOrder ?? 0) + 1;

      const insertValues: typeof schema.galleryImages.$inferInsert = {
        src,
        caption,
        schoolName,
        eventName,
        displayOrder,
        storageKey,
      };
      if (entityId) {
        insertValues.id = entityId;
      }

      await tx.insert(schema.galleryImages).values(insertValues);
    });

    if (entityId) {
      await cleanupEntityStorage('gallery', entityId, storageKey);
    }
  } catch (error) {
    console.error('Failed to add gallery image', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateTag('gallery-images', {});
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
    const [old] = await db
      .select({ storageKey: schema.galleryImages.storageKey })
      .from(schema.galleryImages)
      .where(eq(schema.galleryImages.id, id))
      .limit(1);

    // Only accept storage keys strictly scoped to this entity folder
    const validNewStorageKey = isKeyScopedToEntity(rawStorageKey, 'gallery', id) ? rawStorageKey : null;
    const storageKey = validNewStorageKey ?? (rawStorageKey === '' ? null : (old?.storageKey && isKeyScopedToEntity(old.storageKey, 'gallery', id) ? old.storageKey : null));

    // Scope cleanup strictly to this entity folder, preserving the active key
    await cleanupEntityStorage('gallery', id, storageKey);

    await db
      .update(schema.galleryImages)
      .set({ src, caption, schoolName, eventName, storageKey })
      .where(eq(schema.galleryImages.id, id));
  } catch (error) {
    console.error('Failed to update gallery image', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidateTag('gallery-images', {});
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
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gallery_images_display_order'))`);

      const currentImages = await tx
        .select({ id: schema.galleryImages.id })
        .from(schema.galleryImages)
        .where(isNull(schema.galleryImages.deletedAt));

      const currentIdSet = new Set(currentImages.map((img) => img.id));

      if (
        orderedIds.length !== currentImages.length ||
        new Set(orderedIds).size !== orderedIds.length ||
        !orderedIds.every((id) => currentIdSet.has(id))
      ) {
        throw new ActionError(
          'INVALID_ORDER_PAYLOAD',
          'Image list is out of date or invalid. Please refresh and try again.'
        );
      }

      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(schema.galleryImages)
          .set({ displayOrder: i + 1 })
          .where(eq(schema.galleryImages.id, orderedIds[i]));
      }
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message };
    }
    console.error('Failed to reorder gallery images', error);
    return { success: false, error: 'Could not update order. Please try again.' };
  }

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
  return { success: true };
}

export async function toggleGalleryImageActive(id: string, isActive: boolean) {
  await requirePermission(Permissions.MANAGE_GALLERY);
  try {
    await db
      .update(schema.galleryImages)
      .set({ isActive })
      .where(eq(schema.galleryImages.id, id));
  } catch (error) {
    console.error('Failed to toggle gallery image active state', error);
    return { success: false, error: 'Could not update status. Please try again.' };
  }

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
  return { success: true };
}

export async function deleteGalleryImage(id: string) {
  const user = await requirePermission(Permissions.MANAGE_GALLERY);

  await db.update(schema.galleryImages).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.galleryImages.id, id));

  // Scope cleanup strictly to that entity's folder in Supabase Storage
  await cleanupEntityStorage('gallery', id);

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}
