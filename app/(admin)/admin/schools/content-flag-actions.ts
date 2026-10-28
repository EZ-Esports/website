'use server';

import { revalidatePath } from 'next/cache';
import { getStaffWithPermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { getContentFlagsByMember, markContentFlagReviewed, type ContentFlagView } from '@/app/lib/db/content-flags';

/**
 * Staff side of onboarding content-flag overrides (spec-040). Either roster or school management
 * is enough to see and clear a flag: the roster page shows players' flags, and the school managers
 * dialog shows managers'. Both reads degrade to "nothing flagged" when migration 0055 is not applied.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireFlagReviewer() {
  return (
    (await getStaffWithPermission(Permissions.MANAGE_ROSTERS)) ??
    (await getStaffWithPermission(Permissions.MANAGE_SCHOOLS))
  );
}

/** Override records for these members (school managers), keyed by member id. */
export async function getManagerContentFlags(memberIds: string[]): Promise<Record<string, ContentFlagView>> {
  if (!(await requireFlagReviewer())) return {};
  const ids = (Array.isArray(memberIds) ? memberIds : []).filter((id) => typeof id === 'string' && UUID.test(id));
  try {
    return Object.fromEntries(await getContentFlagsByMember(ids));
  } catch (error) {
    console.error('getManagerContentFlags error:', error);
    return {};
  }
}

/** Marks an override as reviewed by the calling staff member. */
export async function reviewContentFlag(flagId: string): Promise<{ success: boolean; error?: string }> {
  const staff = await requireFlagReviewer();
  if (!staff) return { success: false, error: 'You do not have permission to review flagged information.' };
  if (typeof flagId !== 'string' || !UUID.test(flagId)) return { success: false, error: 'Invalid record.' };
  try {
    const ok = await markContentFlagReviewed(flagId, staff.email || staff.id);
    if (!ok) return { success: false, error: 'That record could not be found. It may not be available yet.' };
    revalidatePath('/admin/schools', 'layout');
    return { success: true };
  } catch (error) {
    console.error('reviewContentFlag error:', error);
    return { success: false, error: 'Could not mark this as reviewed. Please try again.' };
  }
}
