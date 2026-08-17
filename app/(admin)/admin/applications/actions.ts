'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateApplicationStatus(
  id: string,
  status: 'pending' | 'accepted' | 'rejected',
  reason?: string
) {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  await db.insert(schema.applicationStatusLogs).values({
    applicationId: id,
    applicationType: 'school',
    status,
    actorUserId: staff.id,
    actorEmail: staff.email,
    reason: reason ?? null,
  });

  revalidatePath('/admin/applications');
}

export async function updateStaffApplicationStatus(
  id: string,
  status: 'pending' | 'accepted' | 'rejected',
  reason?: string
) {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  await db.insert(schema.applicationStatusLogs).values({
    applicationId: id,
    applicationType: 'staff',
    status,
    actorUserId: staff.id,
    actorEmail: staff.email,
    reason: reason ?? null,
  });

  revalidatePath('/admin/applications');
}

export async function softDeleteSchoolApplication(id: string) {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  await db
    .update(schema.schoolApplications)
    .set({
      deletedAt: new Date(),
      deletedBy: staff.id,
    })
    .where(eq(schema.schoolApplications.id, id));

  revalidatePath('/admin/applications');
}

export async function softDeleteStaffApplication(id: string) {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  await db
    .update(schema.staffApplications)
    .set({
      deletedAt: new Date(),
      deletedBy: staff.id,
    })
    .where(eq(schema.staffApplications.id, id));

  revalidatePath('/admin/applications');
}
