'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServiceClient } from '@/app/lib/supabase/service';
import { safeUrl, sanitizeDbError } from '@/app/lib/text-utils';

async function requireAdmin() {
  return requirePermission(Permissions.MANAGE_SPONSORS);
}

const BUCKET = 'admin-uploads';

function revalidateAll() {
  revalidateTag('sponsors', {});
  revalidatePath('/admin/sponsors');
  revalidatePath('/sponsors');
}

export async function addSponsor(formData: FormData) {
  await requireAdmin();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!name) return { success: false, error: 'Sponsor name is required.' };

  try {
    await db.insert(schema.sponsors).values({ name, logoUrl, tier, websiteUrl, displayOrder, storageKey });
  } catch (error) {
    console.error('Failed to add sponsor', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function updateSponsor(id: string, formData: FormData) {
  await requireAdmin();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const storageKey = (formData.get('storageKey') as string) || null;

  if (!name) return { success: false, error: 'Sponsor name is required.' };

  try {
    // If the image was changed, delete the old file from storage
    if (storageKey) {
      const [old] = await db
        .select({ storageKey: schema.sponsors.storageKey })
        .from(schema.sponsors)
        .where(eq(schema.sponsors.id, id))
        .limit(1);
      if (old?.storageKey && old.storageKey !== storageKey) {
        const supabase = createServiceClient();
        await supabase.storage.from(BUCKET).remove([old.storageKey]);
      }
    }

    await db
      .update(schema.sponsors)
      .set({ name, logoUrl, tier, websiteUrl, displayOrder, storageKey })
      .where(eq(schema.sponsors.id, id));
  } catch (error) {
    console.error('Failed to update sponsor', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function toggleSponsorActive(id: string, isActive: boolean) {
  await requireAdmin();
  try {
    await db
      .update(schema.sponsors)
      .set({ isActive })
      .where(eq(schema.sponsors.id, id));
  } catch (error) {
    console.error('Failed to toggle sponsor active state', error);
    return { success: false, error: 'Could not update status. Please try again.' };
  }
  revalidateAll();
  return { success: true };
}

export async function deleteSponsor(id: string) {
  const user = await requireAdmin();
  // Fetch the row first to get storageKey for cleanup
  const [row] = await db
    .select({ storageKey: schema.sponsors.storageKey })
    .from(schema.sponsors)
    .where(eq(schema.sponsors.id, id))
    .limit(1);

  await db.update(schema.sponsors).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.sponsors.id, id));

  // Remove from Supabase Storage if a key exists
  if (row?.storageKey) {
    const supabase = createServiceClient();
    await supabase.storage.from(BUCKET).remove([row.storageKey]);
  }

  revalidateAll();
}
