'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/app/lib/result';
import { ApplicationStatus, isValidStatusTransition } from '@/app/lib/application-status';
import {
  getApplicationStatusState,
  recordApplicationStatusChange,
  softDeleteApplicationRecord,
  getSchoolApplications,
  getStaffApplications,
} from '@/app/lib/db/queries';
import {
  schoolApplicationsTableToCsv,
  staffApplicationsTableToCsv,
} from '@/app/lib/application-csv';

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  reason?: string
): Promise<ActionResult> {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  const app = await getApplicationStatusState(id, 'school');

  if (!app) {
    return { success: false, error: 'Application not found.' };
  }

  if (app.isDeleted) {
    return { success: false, error: 'Cannot update status of a deleted application.' };
  }

  if (!isValidStatusTransition(app.currentStatus, status)) {
    return {
      success: false,
      error: `Invalid status transition from '${app.currentStatus}' to '${status}'.`,
    };
  }

  await recordApplicationStatusChange({
    applicationId: id,
    applicationType: 'school',
    status,
    actorUserId: staff.id,
    actorEmail: staff.email,
    reason: reason ?? null,
  });

  revalidatePath('/admin/applications');
  return { success: true };
}

export async function updateStaffApplicationStatus(
  id: string,
  status: ApplicationStatus,
  reason?: string
): Promise<ActionResult> {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  const app = await getApplicationStatusState(id, 'staff');

  if (!app) {
    return { success: false, error: 'Application not found.' };
  }

  if (app.isDeleted) {
    return { success: false, error: 'Cannot update status of a deleted application.' };
  }

  if (!isValidStatusTransition(app.currentStatus, status)) {
    return {
      success: false,
      error: `Invalid status transition from '${app.currentStatus}' to '${status}'.`,
    };
  }

  await recordApplicationStatusChange({
    applicationId: id,
    applicationType: 'staff',
    status,
    actorUserId: staff.id,
    actorEmail: staff.email,
    reason: reason ?? null,
  });

  revalidatePath('/admin/applications');
  return { success: true };
}

export async function softDeleteSchoolApplication(id: string): Promise<ActionResult> {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  const app = await getApplicationStatusState(id, 'school');

  if (!app) {
    return { success: false, error: 'Application not found.' };
  }

  if (app.isDeleted) {
    return { success: false, error: 'Application is already deleted.' };
  }

  await softDeleteApplicationRecord(id, 'school', staff.id);

  // Soft delete must NOT append a 'rejected' status log.
  revalidatePath('/admin/applications');
  return { success: true };
}

export async function softDeleteStaffApplication(id: string): Promise<ActionResult> {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  const app = await getApplicationStatusState(id, 'staff');

  if (!app) {
    return { success: false, error: 'Application not found.' };
  }

  if (app.isDeleted) {
    return { success: false, error: 'Application is already deleted.' };
  }

  await softDeleteApplicationRecord(id, 'staff', staff.id);

  // Soft delete must NOT append a 'rejected' status log.
  revalidatePath('/admin/applications');
  return { success: true };
}

export async function exportSchoolApplicationsCsv(status?: string): Promise<string> {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  const statusFilter = status === 'pending' || status === 'accepted' || status === 'rejected' ? status : undefined;
  const applications = await getSchoolApplications(statusFilter as ApplicationStatus | undefined);
  return schoolApplicationsTableToCsv(applications);
}

export async function exportStaffApplicationsCsv(status?: string): Promise<string> {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);
  const statusFilter = status === 'pending' || status === 'accepted' || status === 'rejected' ? status : undefined;
  const applications = await getStaffApplications(statusFilter as ApplicationStatus | undefined);
  return staffApplicationsTableToCsv(applications);
}
