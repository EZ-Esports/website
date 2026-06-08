'use server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
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
}
