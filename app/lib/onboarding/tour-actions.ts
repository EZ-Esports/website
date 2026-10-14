'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { getSchoolManagerContext } from './manager-auth';

/**
 * Records that the signed-in person has ended the portal tour (finished or skipped).
 * Called only when the first-run tour ends, never when it starts, so an abandoned run
 * comes back. Stamps every one of the user's own `school_managers` rows that is still
 * unset, so a new school or academic year never replays it, while another manager at
 * the same school keeps their own rows and still sees the tour. Idempotent (already
 * stamped rows are untouched), and a no-op for a staff admin with no manager row.
 * Replays from the Tutorial button do not call it at all.
 */
export async function completePortalTour(): Promise<{ success: boolean }> {
  const context = await getSchoolManagerContext(undefined, { allowStaffAdmin: true });
  if (!context) {
    throw new Error('Unauthorized');
  }

  await db
    .update(schema.schoolManagers)
    .set({ tourCompletedAt: new Date() })
    .where(
      and(
        eq(schema.schoolManagers.userId, context.userId),
        isNull(schema.schoolManagers.tourCompletedAt),
      ),
    );

  return { success: true };
}
