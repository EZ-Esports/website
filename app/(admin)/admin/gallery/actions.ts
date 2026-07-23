'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServiceClient } from '@/app/lib/supabase/service';
import { sanitizeDbError } from '@/app/lib/text-utils';

const BUCKET = 'admin-uploads';

export async function addGalleryImage(formData: FormData) {
  await requirePermission(Permissions.MANAGE_GALLERY);
  const src = formData.get('src') as string;
  const caption = (formData.get('caption') as string) ?? '';
  const schoolName = (formData.get('schoolName') as string) ?? '';
  const eventName = (formData.get('eventName') as string) ?? '';
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!src) return { success: false, error: 'Please upload an image first.' };
  if (!caption) return { success: false, error: 'A caption (used as alt text) is required.' };

  try {
    // New images always go to the end of the list — display order is derived, never user-entered.
    const [maxOrderResult] = await db
      .select({ maxOrder: sql<number>`max(${schema.galleryImages.displayOrder})` })
      .from(schema.galleryImages)
      .where(isNull(schema.galleryImages.deletedAt));

    const displayOrder = (maxOrderResult?.maxOrder ?? 0) + 1;

    await db.insert(schema.galleryImages).values({ src, caption, schoolName, eventName, displayOrder, storageKey });
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
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!src) return { success: false, error: 'An image is required.' };
  if (!caption) return { success: false, error: 'A caption (used as alt text) is required.' };

  try {
    // If the image was changed, delete the old file from storage
    if (storageKey) {
      const [old] = await db
        .select({ storageKey: schema.galleryImages.storageKey })
        .from(schema.galleryImages)
        .where(eq(schema.galleryImages.id, id))
        .limit(1);
      if (old?.storageKey && old.storageKey !== storageKey) {
        const supabase = createServiceClient();
        await supabase.storage.from(BUCKET).remove([old.storageKey]);
      }
    }

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
 * Persists a full reorder in one shot: the incoming array is the complete,
 * already-deduplicated ordering, so display order is just its index + 1.
 * Rewriting every row (rather than diffing) is what guarantees no duplicate
 * or gapped values even if the client's local state ever drifts from the DB.
 */
export async function updateGalleryImagesOrder(orderedIds: string[]) {
  await requirePermission(Permissions.MANAGE_GALLERY);

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(schema.galleryImages)
          .set({ displayOrder: i + 1 })
          .where(eq(schema.galleryImages.id, orderedIds[i]));
      }
    });
  } catch (error) {
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
  // Fetch the row first to get storageKey for cleanup
  const [row] = await db
    .select({ storageKey: schema.galleryImages.storageKey })
    .from(schema.galleryImages)
    .where(eq(schema.galleryImages.id, id))
    .limit(1);

  await db.update(schema.galleryImages).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.galleryImages.id, id));

  // Remove from Supabase Storage if a key exists
  if (row?.storageKey) {
    const supabase = createServiceClient();
    await supabase.storage.from(BUCKET).remove([row.storageKey]);
  }

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}
