'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApplicationStatus } from '@/app/lib/db/queries';

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

  await db.insert(schema.applicationStatusLogs).values({
    applicationId: id,
    applicationType: 'school',
    status: 'rejected',
    actorUserId: staff.id,
    actorEmail: staff.email,
    reason: 'Application soft-deleted by staff',
  });

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

  await db.insert(schema.applicationStatusLogs).values({
    applicationId: id,
    applicationType: 'staff',
    status: 'rejected',
    actorUserId: staff.id,
    actorEmail: staff.email,
    reason: 'Application soft-deleted by staff',
  });

  revalidatePath('/admin/applications');
}

export async function exportSchoolApplicationsCsv(status?: string): Promise<string> {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  const statusFilter = status === 'pending' || status === 'accepted' || status === 'rejected' ? status : undefined;
  const { getSchoolApplications } = await import('@/app/lib/db/queries');
  const { schoolApplicationsTableToCsv } = await import('@/app/lib/application-csv');
  const applications = await getSchoolApplications(statusFilter as ApplicationStatus | undefined);
  return schoolApplicationsTableToCsv(applications);
}

export async function exportStaffApplicationsCsv(status?: string): Promise<string> {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  const statusFilter = status === 'pending' || status === 'accepted' || status === 'rejected' ? status : undefined;
  const { getStaffApplications } = await import('@/app/lib/db/queries');
  const { staffApplicationsTableToCsv } = await import('@/app/lib/application-csv');
  const applications = await getStaffApplications(statusFilter as ApplicationStatus | undefined);
  return staffApplicationsTableToCsv(applications);
}
