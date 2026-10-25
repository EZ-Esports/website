'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { MAX_STAFF_NOTE_LENGTH } from '@/app/lib/reschedule-rules';

export type RescheduleDecisionResult = { success: boolean; error?: string };

/** Thrown inside the transaction to roll it back with a message the staff member can read. */
class DecisionError extends Error {}

function revalidateMatches() {
  updateTag('matches');
  updateTag('rosters');
  updateTag('teams');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

function cleanNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed ? trimmed : null;
}

/**
 * Approves a request the opponent has accepted: moves the match to the accepted time and closes
 * the request in one transaction. Refuses (rolling back) when the request is no longer waiting
 * on staff, when the match has been moved or has started since the request was made, or when the
 * accepted time has passed, so an approval can never overwrite a newer schedule.
 */
export async function approveReschedule(
  requestId: string,
  note?: string
): Promise<RescheduleDecisionResult> {
  const staff = await requirePermission(Permissions.MANAGE_MATCHES);
  const staffNote = cleanNote(note);
  if (staffNote && staffNote.length > MAX_STAFF_NOTE_LENGTH) {
    return { success: false, error: `Keep the note under ${MAX_STAFF_NOTE_LENGTH} characters.` };
  }

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(schema.matchRescheduleRequests)
        .where(eq(schema.matchRescheduleRequests.id, requestId))
        .limit(1);
      if (!request || request.status !== 'pending_staff' || !request.acceptedOptionId) {
        throw new DecisionError('This request is no longer waiting for staff.');
      }
      const [option] = await tx
        .select()
        .from(schema.matchRescheduleOptions)
        .where(eq(schema.matchRescheduleOptions.id, request.acceptedOptionId))
        .limit(1);
      if (!option || option.proposedAt.getTime() <= Date.now()) {
        throw new DecisionError('The accepted time has already passed. Decline this request.');
      }

      // Only a still-scheduled match at the time the request was made may move.
      const moved = await tx
        .update(schema.matches)
        .set({ scheduledAt: option.proposedAt })
        .where(
          and(
            eq(schema.matches.id, request.matchId),
            eq(schema.matches.status, 'scheduled'),
            eq(schema.matches.scheduledAt, request.originalScheduledAt)
          )
        )
        .returning({ id: schema.matches.id });
      if (moved.length === 0) {
        throw new DecisionError('The match has changed since this request was made. Decline it.');
      }

      await tx
        .update(schema.matchRescheduleRequests)
        .set({ status: 'approved', decidedByStaffId: staff.id, decidedAt: new Date(), staffNote })
        .where(eq(schema.matchRescheduleRequests.id, request.id));
    });
  } catch (error) {
    if (error instanceof DecisionError) return { success: false, error: error.message };
    console.error('Failed to approve reschedule', error);
    return { success: false, error: 'Could not approve the request. Please try again.' };
  }

  revalidateMatches();
  return { success: true };
}

/** Declines a request waiting on staff. The match keeps its time; a note is required. */
export async function declineReschedule(
  requestId: string,
  note: string
): Promise<RescheduleDecisionResult> {
  const staff = await requirePermission(Permissions.MANAGE_MATCHES);
  const staffNote = cleanNote(note);
  if (!staffNote) return { success: false, error: 'Add a note so the managers know why.' };
  if (staffNote.length > MAX_STAFF_NOTE_LENGTH) {
    return { success: false, error: `Keep the note under ${MAX_STAFF_NOTE_LENGTH} characters.` };
  }

  try {
    const updated = await db
      .update(schema.matchRescheduleRequests)
      .set({ status: 'declined_staff', decidedByStaffId: staff.id, decidedAt: new Date(), staffNote })
      .where(
        and(
          eq(schema.matchRescheduleRequests.id, requestId),
          eq(schema.matchRescheduleRequests.status, 'pending_staff')
        )
      )
      .returning({ id: schema.matchRescheduleRequests.id });
    if (updated.length === 0) {
      return { success: false, error: 'This request is no longer waiting for staff.' };
    }
  } catch (error) {
    console.error('Failed to decline reschedule', error);
    return { success: false, error: 'Could not decline the request. Please try again.' };
  }

  revalidatePath('/admin/matches');
  return { success: true };
}
