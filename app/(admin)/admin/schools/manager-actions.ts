'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath, updateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { DrizzleOnboardingRepository } from '@/app/lib/onboarding/adapters/db/drizzle-onboarding-repository';
import { StaffManagerService } from '@/app/lib/onboarding/core/services/staff-manager-service';
import type * as schema from '@/app/lib/db/schema';

const repo = new DrizzleOnboardingRepository();
const staffManagerService = new StaffManagerService(repo);

function revalidateAll() {
  updateTag('schools');
  updateTag('teams');
  revalidatePath('/admin/schools');
  revalidatePath('/');
}

async function requireSchoolsPermission() {
  return requirePermission(Permissions.MANAGE_SCHOOLS);
}

export interface ProvisionSchoolManagerParams {
  schoolId: string;
  email: string;
  userId?: string;
  managedGames?: string[];
  isPrimaryContact?: boolean;
  academicYear?: string;
}

export interface ProvisionSchoolManagerResult {
  success: boolean;
  error?: string;
  manager?: typeof schema.schoolManagers.$inferSelect;
  message?: string;
}

export async function provisionSchoolManager(
  params: ProvisionSchoolManagerParams
): Promise<ProvisionSchoolManagerResult> {
  const actor = await requireSchoolsPermission();
  try {
    const result = await staffManagerService.provisionSchoolManager(actor, params);
    if (result.success) {
      revalidateAll();
    }
    return result as ProvisionSchoolManagerResult;
  } catch (error) {
    return { success: false, error: sanitizeDbError(error) };
  }
}

export interface RemoveSchoolManagerParams {
  managerId: string;
}

export interface RemoveSchoolManagerResult {
  success: boolean;
  error?: string;
  manager?: typeof schema.schoolManagers.$inferSelect;
  message?: string;
}

export async function removeSchoolManager(
  params: RemoveSchoolManagerParams
): Promise<RemoveSchoolManagerResult> {
  const actor = await requireSchoolsPermission();
  try {
    const result = await staffManagerService.removeSchoolManager(actor, params);
    if (result.success) {
      revalidateAll();
    }
    return result;
  } catch (error) {
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function getSchoolManagers(schoolId: string) {
  try {
    return await staffManagerService.getSchoolManagers(schoolId);
  } catch (error) {
    console.error('getSchoolManagers error:', error);
    return [];
  }
}

export interface GenerateManagerInviteParams {
  schoolId: string;
  firstName: string;
  lastName: string;
  email?: string;
  academicYear?: string;
  managedGames?: string[] | null;
  isPrimaryContact?: boolean;
}

export interface GenerateManagerInviteResult {
  success: boolean;
  token?: string;
  inviteUrl?: string;
  inviteId?: string;
  error?: string;
}

export async function generateManagerInvite(
  params: GenerateManagerInviteParams
): Promise<GenerateManagerInviteResult> {
  const actor = await requireSchoolsPermission();
  try {
    return await staffManagerService.generateManagerInvite(actor, params);
  } catch (error) {
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function getSchoolManagerInvites(schoolId: string) {
  try {
    return await staffManagerService.getSchoolManagerInvites(schoolId);
  } catch (error) {
    console.error('getSchoolManagerInvites error:', error);
    return [];
  }
}

export async function revokeManagerInvite(inviteId: string) {
  const actor = await requireSchoolsPermission();
  try {
    return await staffManagerService.revokeManagerInvite(actor, inviteId);
  } catch (error) {
    return { success: false, error: sanitizeDbError(error) };
  }
}

export interface RegisteredManagerAccount {
  userId: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  schools: string[];
}

export async function getRegisteredManagers(searchQuery?: string): Promise<RegisteredManagerAccount[]> {
  try {
    return await staffManagerService.getRegisteredManagers(searchQuery);
  } catch (error) {
    console.error('getRegisteredManagers error:', error);
    return [];
  }
}

export interface AssignExistingManagerParams {
  schoolId: string;
  userId?: string;
  memberId?: string;
  email?: string;
  academicYear?: string;
  managedGames?: string[] | null;
  isPrimaryContact?: boolean;
}

export interface AssignExistingManagerResult {
  success: boolean;
  manager?: typeof schema.schoolManagers.$inferSelect;
  error?: string;
  message?: string;
}

export async function assignExistingManager(
  params: AssignExistingManagerParams
): Promise<AssignExistingManagerResult> {
  const actor = await requireSchoolsPermission();
  try {
    const result = await staffManagerService.assignExistingManager(actor, params);
    if (result.success) {
      revalidateAll();
    }
    return result as AssignExistingManagerResult;
  } catch (error) {
    return { success: false, error: sanitizeDbError(error) };
  }
}
