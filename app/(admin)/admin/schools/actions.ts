'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServiceClient } from '@/app/lib/supabase/service';
import { slugify, safeUrl, sanitizeDbError } from '@/app/lib/text-utils';

async function requireSchoolsPermission() {
  return requirePermission(Permissions.MANAGE_SCHOOLS);
}

const BUCKET = 'admin-uploads';

function revalidateAll() {
  revalidateTag('schools', {});
  revalidatePath('/admin/schools');
  revalidatePath('/');
}

export async function addSchool(formData: FormData) {
  await requireSchoolsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const storageKey = (formData.get('storageKey') as string) || null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return { success: false, error: 'School name is required.' };

  const slug = slugify(name);

  try {
    await db.insert(schema.schools).values({ name, slug, logoUrl, storageKey, websiteUrl, displayOrder });
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
  const newStorageKey = (formData.get('storageKey') as string) || null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return { success: false, error: 'School name is required.' };

  try {
    const [old] = await db
      .select({ storageKey: schema.schools.storageKey })
      .from(schema.schools)
      .where(eq(schema.schools.id, id))
      .limit(1);

    // Delete old file only if a new image was uploaded and differs from the old one
    if (newStorageKey && old?.storageKey && old.storageKey !== newStorageKey) {
      const supabase = createServiceClient();
      await supabase.storage.from(BUCKET).remove([old.storageKey]);
    }

    // Preserve existing storageKey if no new upload was made
    const storageKey = newStorageKey ?? old?.storageKey ?? null;

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
  // Fetch the row first to get storageKey for cleanup
  const [row] = await db
    .select({ storageKey: schema.schools.storageKey })
    .from(schema.schools)
    .where(eq(schema.schools.id, id))
    .limit(1);

  await db.update(schema.schools).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.schools.id, id));

  // Remove from Supabase Storage if a key exists
  if (row?.storageKey) {
    const supabase = createServiceClient();
    await supabase.storage.from(BUCKET).remove([row.storageKey]);
  }

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
