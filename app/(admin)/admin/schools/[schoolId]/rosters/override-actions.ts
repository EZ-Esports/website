'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { memberInSchool } from '@/app/lib/db/roster-scope';

/**
 * Staff review of an onboarding content override (spec-040): the student confirmed a flagged field as their
 * real information, and staff record that they looked at it. Same permission as editing rosters
 * (MANAGE_ROSTERS). The submitted value is never logged here.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX_LENGTH = 500;

export async function markContentOverrideReviewed(schoolId: string, overrideId: string, note: string) {
  const staff = await requirePermission(Permissions.MANAGE_ROSTERS);
  if (!UUID.test(schoolId) || !UUID.test(overrideId)) {
    return { success: false as const, error: 'That record was not found for this school.' };
  }

  const [row] = await db
    .select({ id: schema.onboardingContentOverrides.id, memberId: schema.onboardingContentOverrides.memberId })
    .from(schema.onboardingContentOverrides)
    .where(eq(schema.onboardingContentOverrides.id, overrideId))
    .limit(1);
  // The override must belong to a member of this school, so a form for one school cannot touch another's.
  if (!row || !(await memberInSchool(row.memberId, schoolId))) {
    return { success: false as const, error: 'That record was not found for this school.' };
  }

  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, NOTE_MAX_LENGTH) : '';
  await db
    .update(schema.onboardingContentOverrides)
    .set({
      reviewedAt: new Date(),
      reviewedBy: staff.id,
      reviewNote: trimmedNote || null,
    })
    .where(
      and(
        eq(schema.onboardingContentOverrides.id, overrideId),
        // A review is final: a second reviewer does not overwrite the first one's decision.
        isNull(schema.onboardingContentOverrides.reviewedAt)
      )
    );

  revalidatePath(`/admin/schools/${schoolId}/rosters`);
  return { success: true as const };
}
