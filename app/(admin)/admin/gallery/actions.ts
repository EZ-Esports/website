'use server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/app/lib/supabase/server';

const BUCKET = 'admin-uploads';

export async function addGalleryImage(formData: FormData) {
  const src = formData.get('src') as string;
  const caption = (formData.get('caption') as string) ?? '';
  const schoolName = (formData.get('schoolName') as string) ?? '';
  const eventName = (formData.get('eventName') as string) ?? '';
  const setId = parseInt(formData.get('setId') as string) || 1;
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!src) return;

  await db.insert(schema.galleryImages).values({ src, caption, schoolName, eventName, setId, displayOrder, storageKey });
  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}

export async function updateGalleryImage(id: string, formData: FormData) {
  const src = formData.get('src') as string;
  const caption = (formData.get('caption') as string) ?? '';
  const schoolName = (formData.get('schoolName') as string) ?? '';
  const eventName = (formData.get('eventName') as string) ?? '';
  const setId = parseInt(formData.get('setId') as string) || 1;
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!src) return;

  // If the image was changed, delete the old file from storage
  if (storageKey) {
    const [old] = await db
      .select({ storageKey: schema.galleryImages.storageKey })
      .from(schema.galleryImages)
      .where(eq(schema.galleryImages.id, id))
      .limit(1);
    if (old?.storageKey && old.storageKey !== storageKey) {
      const supabase = await createClient();
      await supabase.storage.from(BUCKET).remove([old.storageKey]);
    }
  }

  await db
    .update(schema.galleryImages)
    .set({ src, caption, schoolName, eventName, setId, displayOrder, storageKey })
    .where(eq(schema.galleryImages.id, id));

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}

export async function toggleGalleryImageActive(id: string, isActive: boolean) {
  await db
    .update(schema.galleryImages)
    .set({ isActive })
    .where(eq(schema.galleryImages.id, id));

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}

export async function deleteGalleryImage(id: string) {
  // Fetch the row first to get storageKey for cleanup
  const [row] = await db
    .select({ storageKey: schema.galleryImages.storageKey })
    .from(schema.galleryImages)
    .where(eq(schema.galleryImages.id, id))
    .limit(1);

  await db.delete(schema.galleryImages).where(eq(schema.galleryImages.id, id));

  // Remove from Supabase Storage if a key exists
  if (row?.storageKey) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([row.storageKey]);
  }

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}
