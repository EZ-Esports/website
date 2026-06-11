'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/app/lib/supabase/server';
import { safeUrl } from '@/app/lib/text-utils';

const BUCKET = 'admin-uploads';

function revalidateAll() {
  revalidateTag('sponsors', {});
  revalidatePath('/admin/sponsors');
  revalidatePath('/sponsors');
}

export async function addSponsor(formData: FormData) {
  await requireUser();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!name) return;

  await db.insert(schema.sponsors).values({ name, logoUrl, tier, websiteUrl, displayOrder, storageKey });
  revalidateAll();
}

export async function updateSponsor(id: string, formData: FormData) {
  await requireUser();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!name) return;

  // If the image was changed, delete the old file from storage
  if (storageKey) {
    const [old] = await db
      .select({ storageKey: schema.sponsors.storageKey })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, id))
      .limit(1);
    if (old?.storageKey && old.storageKey !== storageKey) {
      const supabase = await createClient();
      await supabase.storage.from(BUCKET).remove([old.storageKey]);
    }
  }

  await db
    .update(schema.sponsors)
    .set({ name, logoUrl, tier, websiteUrl, displayOrder, storageKey })
    .where(eq(schema.sponsors.id, id));
  revalidateAll();
}

export async function toggleSponsorActive(id: string, isActive: boolean) {
  await requireUser();
  await db
    .update(schema.sponsors)
    .set({ isActive })
    .where(eq(schema.sponsors.id, id));
  revalidateAll();
}

export async function deleteSponsor(id: string) {
  const user = await requireUser();
  // Fetch the row first to get storageKey for cleanup
  const [row] = await db
    .select({ storageKey: schema.sponsors.storageKey })
    .from(schema.sponsors)
    .where(eq(schema.sponsors.id, id))
    .limit(1);

  await db.update(schema.sponsors).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.sponsors.id, id));

  // Remove from Supabase Storage if a key exists
  if (row?.storageKey) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([row.storageKey]);
  }

  revalidateAll();
}
