import { hasStaffMemberRow, isActiveSchoolManager } from '@/app/lib/db/staff';

/**
 * Where a freshly signed-in identity belongs. School managers are portal-only
 * users: sending them to /admin would otherwise provision a staff directory row
 * as a side effect. Anyone who already has a staff row (including people who
 * are both staff and managers) keeps /admin.
 */
export async function resolvePostLoginDestination(
  userId: string,
  email: string,
): Promise<'/admin' | '/portal'> {
  if (await hasStaffMemberRow(userId)) return '/admin';
  return (await isActiveSchoolManager(userId, email)) ? '/portal' : '/admin';
}
