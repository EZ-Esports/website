'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateApplicationStatus(id: string, status: 'pending' | 'reviewed' | 'accepted') {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  await db.update(schema.schoolApplications).set({ status }).where(eq(schema.schoolApplications.id, id));
  revalidatePath('/admin/applications');
}

export async function deleteApplication(id: string) {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  await db.delete(schema.schoolApplications).where(eq(schema.schoolApplications.id, id));
  revalidatePath('/admin/applications');
}

export async function updateStaffApplicationStatus(id: string, status: 'pending' | 'reviewed' | 'accepted') {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  await db.update(schema.staffApplications).set({ status }).where(eq(schema.staffApplications.id, id));
  revalidatePath('/admin/applications');
}

export async function deleteStaffApplication(id: string) {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  await db.delete(schema.staffApplications).where(eq(schema.staffApplications.id, id));
  revalidatePath('/admin/applications');
}
