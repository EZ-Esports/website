'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';

export async function createLeader(formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEADERSHIP);
  const name = (formData.get('name') as string)?.trim();
  const role = (formData.get('role') as string)?.trim();
  const year = (formData.get('year') as string)?.trim();
  const handle = (formData.get('handle') as string)?.trim() || null;
  const memberId = (formData.get('memberId') as string)?.trim() || null;
  const highSchool = (formData.get('highSchool') as string)?.trim() || null;
  const university = (formData.get('university') as string)?.trim() || null;

  if (!name || !role || !year) {
    return { success: false, error: 'Name, Role, and Year are required.' };
  }

  try {
    await db.insert(schema.leadership).values({
      name,
      handle,
      role,
      year,
      memberId,
      highSchool,
      university,
    });
  } catch (error) {
    console.error('Failed to create leader', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  // Revalidate query cache and public pages
  revalidateTag('leadership', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
  return { success: true };
}

export async function updateLeader(id: string, year: string, formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEADERSHIP);
  const name = (formData.get('name') as string)?.trim();
  const handle = (formData.get('handle') as string)?.trim() || null;
  const role = (formData.get('role') as string)?.trim();
  const newYear = (formData.get('year') as string)?.trim();
  const memberId = (formData.get('memberId') as string)?.trim() || null;
  const highSchool = (formData.get('highSchool') as string)?.trim() || null;
  const university = (formData.get('university') as string)?.trim() || null;
  if (!name || !role || !newYear) return { success: false, error: 'Name, Role, and Year are required.' };
  try {
    await db.update(schema.leadership).set({ name, handle, role, year: newYear, memberId, highSchool, university }).where(eq(schema.leadership.id, id));
  } catch (error) {
    console.error('Failed to update leader', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateTag('leadership', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
  revalidatePath(`/leadership/${newYear}`);
  return { success: true };
}

export async function deleteLeader(id: string, year: string) {
  const user = await requirePermission(Permissions.MANAGE_LEADERSHIP);
  await db.update(schema.leadership).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.leadership.id, id));

  // Revalidate query cache and public pages
  revalidateTag('leadership', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
}
