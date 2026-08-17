'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
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
