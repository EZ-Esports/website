'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { slugify, safeUrl, sanitizeDbError } from '@/app/lib/text-utils';
import { cleanupEntityStorage, isKeyScopedToEntity, sanitizeEntityId } from '@/app/lib/storage';

async function requireSchoolsPermission() {
  return requirePermission(Permissions.MANAGE_SCHOOLS);
}

function revalidateAll() {
  revalidateTag('schools', {});
  revalidatePath('/admin/schools');
  revalidatePath('/');
}

export async function addSchool(formData: FormData) {
  await requireSchoolsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const rawEntityId = (formData.get('entityId') || formData.get('id')) as string | null;
  const entityId = sanitizeEntityId(rawEntityId);
  const rawStorageKey = (formData.get('storageKey') as string) || null;
  const storageKey = entityId && isKeyScopedToEntity(rawStorageKey, 'schools', entityId) ? rawStorageKey : null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return { success: false, error: 'School name is required.' };

  const slug = slugify(name);

  try {
    const insertValues: typeof schema.schools.$inferInsert = {
      name,
      slug,
      logoUrl,
      storageKey,
      websiteUrl,
      displayOrder,
    };
    if (entityId) {
      insertValues.id = entityId;
    }
    await db.insert(schema.schools).values(insertValues);

    if (entityId) {
      await cleanupEntityStorage('schools', entityId, storageKey);
    }
  } catch (error) {
    console.error('Failed to add school', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function updateSchool(id: string, formData: FormData) {
  await requireSchoolsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const rawStorageKey = (formData.get('storageKey') as string) || null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return { success: false, error: 'School name is required.' };

  try {
    const [old] = await db
      .select({ storageKey: schema.schools.storageKey })
      .from(schema.schools)
      .where(eq(schema.schools.id, id))
      .limit(1);

    // Only accept storage keys strictly scoped to this entity folder
    const validNewStorageKey = isKeyScopedToEntity(rawStorageKey, 'schools', id) ? rawStorageKey : null;
    const storageKey = validNewStorageKey ?? (rawStorageKey === '' ? null : (old?.storageKey && isKeyScopedToEntity(old.storageKey, 'schools', id) ? old.storageKey : null));

    // Scope cleanup strictly to this entity folder
    await cleanupEntityStorage('schools', id, storageKey);

    await db
      .update(schema.schools)
      .set({ name, logoUrl, storageKey, websiteUrl, displayOrder })
      .where(eq(schema.schools.id, id));
  } catch (error) {
    console.error('Failed to update school', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function deleteSchool(id: string) {
  const user = await requireSchoolsPermission();

  await db.update(schema.schools).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.schools.id, id));

  // Scope cleanup strictly to that entity's folder in Supabase Storage
  await cleanupEntityStorage('schools', id);

  revalidateAll();
}

export async function toggleSchoolActive(id: string, isActive: boolean) {
  await requireSchoolsPermission();
  try {
    await db
      .update(schema.schools)
      .set({ isActive })
      .where(eq(schema.schools.id, id));
  } catch (error) {
    console.error('Failed to toggle school active state', error);
    return { success: false, error: 'Could not update status. Please try again.' };
  }
  revalidateAll();
  return { success: true };
}
