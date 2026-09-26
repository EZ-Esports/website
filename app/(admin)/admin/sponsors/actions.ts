'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { safeUrl, sanitizeDbError } from '@/app/lib/text-utils';
import { cleanupEntityStorage, isKeyScopedToEntity, sanitizeEntityId } from '@/app/lib/storage';

async function requireSponsorsPermission() {
  return requirePermission(Permissions.MANAGE_SPONSORS);
}

function revalidateAll() {
  revalidateTag('sponsors', {});
  revalidatePath('/admin/sponsors');
  revalidatePath('/sponsors');
}

export async function addSponsor(formData: FormData) {
  await requireSponsorsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const rawEntityId = (formData.get('entityId') || formData.get('id')) as string | null;
  const entityId = sanitizeEntityId(rawEntityId);
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const rawStorageKey = (formData.get('storageKey') as string) || null;
  const storageKey = entityId && isKeyScopedToEntity(rawStorageKey, 'sponsors', entityId) ? rawStorageKey : null;

  if (!name) return { success: false, error: 'Sponsor name is required.' };

  try {
    const insertValues: typeof schema.sponsors.$inferInsert = {
      name,
      logoUrl,
      tier,
      websiteUrl,
      displayOrder,
      storageKey,
    };
    if (entityId) {
      insertValues.id = entityId;
    }
    await db.insert(schema.sponsors).values(insertValues);

    if (entityId) {
      await cleanupEntityStorage('sponsors', entityId, storageKey);
    }
  } catch (error) {
    console.error('Failed to add sponsor', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function updateSponsor(id: string, formData: FormData) {
  await requireSponsorsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const tier = formData.get('tier') as 'platinum' | 'gold' | 'community';
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;
  const rawStorageKey = (formData.get('storageKey') as string) || null;

  if (!name) return { success: false, error: 'Sponsor name is required.' };

  try {
    const [old] = await db
      .select({ storageKey: schema.sponsors.storageKey })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, id))
      .limit(1);

    // Only accept storage keys strictly scoped to this entity folder
    const validNewStorageKey = isKeyScopedToEntity(rawStorageKey, 'sponsors', id) ? rawStorageKey : null;
    const storageKey = validNewStorageKey ?? (rawStorageKey === '' ? null : (old?.storageKey && isKeyScopedToEntity(old.storageKey, 'sponsors', id) ? old.storageKey : null));

    // Scope cleanup strictly to this entity folder
    await cleanupEntityStorage('sponsors', id, storageKey);

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
  await requireSponsorsPermission();
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
  const user = await requireSponsorsPermission();

  await db.update(schema.sponsors).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.sponsors.id, id));

  // Scope cleanup strictly to that entity's folder in Supabase Storage
  await cleanupEntityStorage('sponsors', id);

  revalidateAll();
}
