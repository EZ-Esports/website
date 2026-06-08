'use server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function addSponsor(formData: FormData) {
  const name = formData.get('name') as string;
  const logoUrl = formData.get('logoUrl') as string;
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = formData.get('websiteUrl') as string;
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return;

  await db.insert(schema.sponsors).values({ name, logoUrl, tier, websiteUrl, displayOrder });
  revalidateTag('sponsors', {});
  revalidatePath('/admin/sponsors');
}
