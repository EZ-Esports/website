'use server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function addGalleryImage(formData: FormData) {
  const src = formData.get('src') as string;
  const caption = (formData.get('caption') as string) ?? '';
  const schoolName = (formData.get('schoolName') as string) ?? '';
  const eventName = (formData.get('eventName') as string) ?? '';
  const setId = parseInt(formData.get('setId') as string) || 1;
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!src) return;

  await db.insert(schema.galleryImages).values({ src, caption, schoolName, eventName, setId, displayOrder });
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

  if (!src) return;

  await db
    .update(schema.galleryImages)
    .set({ src, caption, schoolName, eventName, setId, displayOrder })
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
  await db.delete(schema.galleryImages).where(eq(schema.galleryImages.id, id));

  revalidateTag('gallery-images', {});
  revalidatePath('/admin/gallery');
  revalidatePath('/');
}
