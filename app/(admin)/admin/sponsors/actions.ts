'use server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

function revalidateAll() {
  revalidateTag('sponsors', {});
  revalidatePath('/admin/sponsors');
  revalidatePath('/sponsors');
}

export async function addSponsor(formData: FormData) {
  const name = formData.get('name') as string;
  const logoUrl = formData.get('logoUrl') as string;
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = formData.get('websiteUrl') as string;
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return;

  await db.insert(schema.sponsors).values({ name, logoUrl, tier, websiteUrl, displayOrder });
  revalidateAll();
}

export async function updateSponsor(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const logoUrl = formData.get('logoUrl') as string;
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = formData.get('websiteUrl') as string;
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return;

  await db
    .update(schema.sponsors)
    .set({ name, logoUrl, tier, websiteUrl, displayOrder })
    .where(eq(schema.sponsors.id, id));
  revalidateAll();
}

export async function toggleSponsorActive(id: string, isActive: boolean) {
  await db
    .update(schema.sponsors)
    .set({ isActive })
    .where(eq(schema.sponsors.id, id));
  revalidateAll();
}

export async function deleteSponsor(id: string) {
  await db.delete(schema.sponsors).where(eq(schema.sponsors.id, id));
  revalidateAll();
}
