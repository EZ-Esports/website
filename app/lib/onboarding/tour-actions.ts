'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { getSchoolManagerContext } from './manager-auth';

/**
 * Records that the signed-in account has ended the portal tour (finished or skipped).
 * Called only when the tour ends, never when it starts, so a manager who abandons it
 * mid-way sees it again. Idempotent, so a repeated call never moves the original
 * completion time. Replays from the Tutorial button do not call it at all.
 */
export async function completePortalTour(): Promise<{ success: boolean }> {
  const context = await getSchoolManagerContext(undefined, { allowStaffAdmin: true });
  if (!context) {
    throw new Error('Unauthorized');
  }

  await db
    .insert(schema.managerPortalTours)
    .values({ userId: context.userId })
    .onConflictDoNothing({ target: schema.managerPortalTours.userId });

  return { success: true };
}
