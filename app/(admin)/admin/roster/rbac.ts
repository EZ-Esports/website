import { requirePermission, type StaffIdentity } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';

export async function requireRosterPermission(): Promise<StaffIdentity> {
  return requirePermission(Permissions.MANAGE_ROSTERS);
}

export type ScopedSchoolResult =
  | { success: true; schoolId?: string | null }
  | { success: false; error: string };

export function getScopedSchoolId(
  staff: StaffIdentity,
  requestedSchoolId?: string | null,
): ScopedSchoolResult {
  const isGlobalAdmin =
    staff.isOwner || (staff.permissions & Permissions.ADMINISTRATOR) !== BigInt(0);

  if (isGlobalAdmin) {
    return { success: true, schoolId: requestedSchoolId ?? null };
  }

  if (staff.schoolId) {
    if (requestedSchoolId && requestedSchoolId !== staff.schoolId) {
      return {
        success: false,
        error: 'Unauthorized: You are only authorized to manage rosters for your assigned school.',
      };
    }
    return { success: true, schoolId: staff.schoolId };
  }

  return {
    success: false,
    error: 'Unauthorized: You are only authorized to manage rosters for your assigned school.',
  };
}
