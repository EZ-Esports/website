'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { revalidatePath, updateTag } from 'next/cache';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { parseEastern } from '@/app/lib/dates';
import {
  MAX_REASON_LENGTH,
  canCancelRequest,
  hasUsedRescheduleAllowance,
  rescheduleAllowanceMessage,
  canOpponentRespond,
  canRequesterRespond,
  isLateRequest,
  validateProposedTimes,
  type RescheduleStatus,
} from '@/app/lib/reschedule-rules';
import { assertManagerForSchoolGame } from './manager-auth';

export type RescheduleActionResult = { success: boolean; error?: string };

/**
 * A refusal whose message is safe to show. Next.js replaces the message of an error thrown from a
 * server action with a generic one in production, so every refusal is returned as a result
 * instead (see `withActionErrors`).
 */
class ActionError extends Error {}

/** Turns a thrown refusal into a result, and an unexpected failure into a generic one. */
async function withActionErrors(
  run: () => Promise<RescheduleActionResult>
): Promise<RescheduleActionResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ActionError) return { success: false, error: error.message };
    console.error('Reschedule action failed', error);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

const homeRoster = alias(schema.rosters, 'home_roster');
const awayRoster = alias(schema.rosters, 'away_roster');
const homeTeam = alias(schema.teams, 'home_team');
const awayTeam = alias(schema.teams, 'away_team');

/** The match facts every reschedule action needs, in one read. */
async function loadMatch(matchId: string) {
  const [match] = await db
    .select({
      id: schema.matches.id,
      seasonId: schema.matches.seasonId,
      gameId: schema.seasons.gameId,
      status: schema.matches.status,
      scheduledAt: schema.matches.scheduledAt,
      homeSchoolId: homeTeam.schoolId,
      awaySchoolId: awayTeam.schoolId,
    })
    .from(schema.matches)
    .innerJoin(schema.seasons, eq(schema.matches.seasonId, schema.seasons.id))
    .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
    .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
    .where(eq(schema.matches.id, matchId))
    .limit(1);
  return match ?? null;
}

type LoadedMatch = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

/**
 * Authorizes the caller to act for `schoolId` on this match, and says whether that is a staff admin.
 * A manager must manage that school and the match's game in the match's own season (a write, so an
 * inactive season is refused). A staff admin (spec-055) acts as the school whose portal they are
 * viewing: `schoolId` comes from the UI but is validated here, since it must be one of the two
 * sides of the match, and the season checks do not apply to them. Either way the side taken
 * (requester or responder) is derived from `schoolId` alone, and the acting user's own id is what
 * callers record, so a staff action is never attributed to a manager.
 */
async function authorizeForMatch(
  schoolId: string,
  match: LoadedMatch
): Promise<{ userId: string; isStaff: boolean }> {
  let authorized: Awaited<ReturnType<typeof assertManagerForSchoolGame>>;
  try {
    authorized = await assertManagerForSchoolGame(schoolId, match.gameId);
  } catch (error) {
    // The guard's own messages (not authorized, view-only season) are safe to show.
    throw new ActionError(error instanceof Error ? error.message : 'You cannot do this.');
  }
  const { context, season } = authorized;
  if (!context.isStaffAdmin && (!season || season.id !== match.seasonId)) {
    throw new ActionError('This match is not in your season.');
  }
  if (match.homeSchoolId !== schoolId && match.awaySchoolId !== schoolId) {
    throw new ActionError('Your school is not playing in this match.');
  }
  return { userId: context.userId, isStaff: context.isStaffAdmin };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'
  );
}

export interface RequestRescheduleParams {
  matchId: string;
  schoolId: string;
  reason: string;
  /** Eastern wall-clock times (`YYYY-MM-DDTHH:mm`), as a datetime-local input produces. */
  proposedTimes: string[];
}

async function requestRescheduleImpl(
  params: RequestRescheduleParams
): Promise<RescheduleActionResult> {
  const reason = params.reason?.trim() ?? '';
  if (!reason) return { success: false, error: 'Explain why the match needs to move.' };
  if (reason.length > MAX_REASON_LENGTH) {
    return { success: false, error: `Keep the reason under ${MAX_REASON_LENGTH} characters.` };
  }

  const match = await loadMatch(params.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  const { userId, isStaff } = await authorizeForMatch(params.schoolId, match);

  if (match.homeSchoolId === match.awaySchoolId) {
    return { success: false, error: 'A match between two squads of one school is moved by staff.' };
  }
  const now = new Date();
  if (match.status !== 'scheduled' || match.scheduledAt.getTime() <= now.getTime()) {
    return { success: false, error: 'Only a scheduled match that has not started can be rescheduled.' };
  }

  const times = (params.proposedTimes ?? []).map((t) => parseEastern(t));
  const problem = validateProposedTimes(times, now, match.scheduledAt);
  if (problem) return { success: false, error: problem };

  try {
    await db.transaction(async (tx) => {
      // Race-safe per-season limit: the school's row is locked until this transaction commits, so a
      // second request from the same school waits here and then counts the first one. The count
      // runs after the lock, so under READ COMMITTED it sees the first request's insert.
      await tx
        .select({ id: schema.schools.id })
        .from(schema.schools)
        .where(eq(schema.schools.id, params.schoolId))
        .for('update');
      const [used] = await tx
        .select({ used: sql<number>`count(*)::int` })
        .from(schema.matchRescheduleRequests)
        .innerJoin(schema.matches, eq(schema.matchRescheduleRequests.matchId, schema.matches.id))
        .where(
          and(
            eq(schema.matchRescheduleRequests.requestedBySchoolId, params.schoolId),
            eq(schema.matches.seasonId, match.seasonId),
            ne(schema.matchRescheduleRequests.status, 'cancelled')
          )
        );
      // Staff are exempt from the one-request-per-season limit (spec-039, spec-055).
      if (!isStaff && hasUsedRescheduleAllowance(Number(used.used))) throw new ActionError(rescheduleAllowanceMessage());

      const [request] = await tx
        .insert(schema.matchRescheduleRequests)
        .values({
          matchId: match.id,
          requestedBySchoolId: params.schoolId,
          requestedByUserId: userId,
          reason,
          isLate: isLateRequest(match.scheduledAt, now),
          originalScheduledAt: match.scheduledAt,
        })
        .returning({ id: schema.matchRescheduleRequests.id });
      await tx
        .insert(schema.matchRescheduleOptions)
        .values(times.map((proposedAt) => ({ requestId: request.id, proposedAt })));
    });
  } catch (error) {
    if (error instanceof ActionError) throw error;
    if (isUniqueViolation(error)) {
      return { success: false, error: 'This match already has an open reschedule request.' };
    }
    console.error('Failed to create reschedule request', error);
    return { success: false, error: 'Could not send the request. Please try again.' };
  }
  return { success: true };
}

async function loadRequest(requestId: string) {
  const [request] = await db
    .select()
    .from(schema.matchRescheduleRequests)
    .where(eq(schema.matchRescheduleRequests.id, requestId))
    .limit(1);
  return request ?? null;
}

export interface RespondToRescheduleParams {
  requestId: string;
  /**
   * The school answering: the opposing school while the request waits on them, or the requesting
   * school once the opponent has sent a counter-offer.
   */
  schoolId: string;
  accept: boolean;
  /** Required when accepting: one of the times the other school proposed. */
  optionId?: string;
}

/**
 * Accepts one of the other school's times, or declines. Who answers depends on the status: the
 * opponent answers the requester's times (`pending_opponent`); after a counter-offer the
 * requester answers the opponent's times (`pending_requester`). Either way an accept moves the
 * match at once (no staff step, spec-054), and a school can only pick times the other side proposed.
 */
async function respondToRescheduleImpl(
  params: RespondToRescheduleParams
): Promise<RescheduleActionResult> {
  const request = await loadRequest(params.requestId);
  if (!request) return { success: false, error: 'Request not found.' };
  const match = await loadMatch(request.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  const { userId } = await authorizeForMatch(params.schoolId, match);

  const status = request.status as RescheduleStatus;
  const answeringCounter = canRequesterRespond(status);
  if (!answeringCounter && !canOpponentRespond(status)) {
    return { success: false, error: 'This request is no longer waiting for your answer.' };
  }
  const isRequester = params.schoolId === request.requestedBySchoolId;
  if (answeringCounter !== isRequester) {
    return {
      success: false,
      error: answeringCounter
        ? 'The school that made the request has to answer this counter-offer.'
        : 'The other school has to answer your request.',
    };
  }
  // Declining stays possible after the match moved or started, so a stale request cannot sit
  // open and block the match's next one; accepting would move a different match than was asked.
  const matchUnchanged =
    match.status === 'scheduled' && match.scheduledAt.getTime() === request.originalScheduledAt.getTime();
  if (params.accept && !matchUnchanged) {
    return { success: false, error: 'The match has changed since this request was made. Decline it.' };
  }

  const now = new Date();
  const answer = answeringCounter
    ? { counterRespondedByUserId: userId, counterRespondedAt: now }
    : { opponentRespondedByUserId: userId, opponentRespondedAt: now };
  const awaiting = answeringCounter ? 'pending_requester' : 'pending_opponent';

  if (!params.accept) {
    const updated = await db
      .update(schema.matchRescheduleRequests)
      .set({ ...answer, status: answeringCounter ? 'declined_requester' : 'declined_opponent' })
      .where(
        and(
          eq(schema.matchRescheduleRequests.id, request.id),
          eq(schema.matchRescheduleRequests.status, awaiting)
        )
      )
      .returning({ id: schema.matchRescheduleRequests.id });
    return updated.length
      ? { success: true }
      : { success: false, error: 'This request was already resolved.' };
  }

  if (!params.optionId) return { success: false, error: 'Choose one of the proposed times.' };
  const [option] = await db
    .select()
    .from(schema.matchRescheduleOptions)
    .where(
      and(
        eq(schema.matchRescheduleOptions.id, params.optionId),
        eq(schema.matchRescheduleOptions.requestId, request.id),
        // Only the other school's times can be picked, never your own.
        eq(schema.matchRescheduleOptions.proposedBy, answeringCounter ? 'opponent' : 'requester')
      )
    )
    .limit(1);
  if (!option) return { success: false, error: 'That time is not part of this request.' };
  if (option.proposedAt.getTime() <= now.getTime()) {
    return { success: false, error: 'That time has already passed. Choose another or decline.' };
  }

  // The move and the close are one transaction. The match only moves from the exact state the
  // request was made against, and the request only closes from the status read above; either
  // guard failing throws, which rolls the other write back, so a race loses cleanly.
  try {
    await db.transaction(async (tx) => {
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
        throw new ActionError('The match has changed since this request was made. Decline it.');
      }
      const closed = await tx
        .update(schema.matchRescheduleRequests)
        .set({ ...answer, status: 'approved', acceptedOptionId: option.id })
        .where(
          and(
            eq(schema.matchRescheduleRequests.id, request.id),
            eq(schema.matchRescheduleRequests.status, awaiting)
          )
        )
        .returning({ id: schema.matchRescheduleRequests.id });
      if (closed.length === 0) throw new ActionError('This request was already resolved.');
    });
  } catch (error) {
    if (error instanceof ActionError) throw error;
    console.error('Failed to accept reschedule', error);
    return { success: false, error: 'Could not move the match. Please try again.' };
  }

  updateTag('matches');
  updateTag('rosters');
  updateTag('teams');
  revalidatePath('/admin/matches');
  revalidatePath('/portal');
  revalidatePath('/');
  return { success: true };
}

export interface CounterRescheduleParams {
  requestId: string;
  /** The opposing school, answering the requester's times with its own. */
  schoolId: string;
  /** Eastern wall-clock times (`YYYY-MM-DDTHH:mm`), as a datetime-local input produces. */
  proposedTimes: string[];
}

/**
 * The opponent's third answer, besides accept and decline: propose 2 to 5 times of their own.
 * One round only: the requester then picks one (or declines), and cannot counter again.
 */
async function counterRescheduleImpl(
  params: CounterRescheduleParams
): Promise<RescheduleActionResult> {
  const request = await loadRequest(params.requestId);
  if (!request) return { success: false, error: 'Request not found.' };
  const match = await loadMatch(request.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  const { userId } = await authorizeForMatch(params.schoolId, match);

  if (params.schoolId === request.requestedBySchoolId) {
    return { success: false, error: 'The other school has to answer your request.' };
  }
  if (!canOpponentRespond(request.status as RescheduleStatus)) {
    return { success: false, error: 'This request is no longer waiting for your answer.' };
  }
  const now = new Date();
  if (match.status !== 'scheduled' || match.scheduledAt.getTime() !== request.originalScheduledAt.getTime()) {
    return { success: false, error: 'The match has changed since this request was made. Decline it.' };
  }

  const times = (params.proposedTimes ?? []).map((t) => parseEastern(t));
  const problem = validateProposedTimes(times, now, match.scheduledAt);
  if (problem) return { success: false, error: problem };

  // A time the requester already offered should simply be accepted, not countered.
  const offered = await db
    .select({ proposedAt: schema.matchRescheduleOptions.proposedAt })
    .from(schema.matchRescheduleOptions)
    .where(eq(schema.matchRescheduleOptions.requestId, request.id));
  const offeredTimes = new Set(offered.map((o) => o.proposedAt.getTime()));
  if (times.some((t) => offeredTimes.has(t.getTime()))) {
    return { success: false, error: 'One of those times was already proposed. Accept it instead.' };
  }

  try {
    await db.transaction(async (tx) => {
      // Conditional so a request resolved in the meantime is not revived; throwing rolls back.
      const moved = await tx
        .update(schema.matchRescheduleRequests)
        .set({ status: 'pending_requester', opponentRespondedByUserId: userId, opponentRespondedAt: now })
        .where(
          and(
            eq(schema.matchRescheduleRequests.id, request.id),
            eq(schema.matchRescheduleRequests.status, 'pending_opponent')
          )
        )
        .returning({ id: schema.matchRescheduleRequests.id });
      if (moved.length === 0) throw new ActionError('This request was already resolved.');
      await tx
        .insert(schema.matchRescheduleOptions)
        .values(times.map((proposedAt) => ({ requestId: request.id, proposedAt, proposedBy: 'opponent' })));
    });
  } catch (error) {
    if (error instanceof ActionError) throw error;
    console.error('Failed to send counter-offer', error);
    return { success: false, error: 'Could not send your times. Please try again.' };
  }
  return { success: true };
}

export interface CancelRescheduleParams {
  requestId: string;
  /** The cancelling school: the requester, or either school once a counter-offer is waiting. */
  schoolId: string;
}

const NO_LONGER_CANCELLABLE = 'A time has already been agreed, so this can no longer be cancelled.';

async function cancelRescheduleImpl(
  params: CancelRescheduleParams
): Promise<RescheduleActionResult> {
  const request = await loadRequest(params.requestId);
  if (!request) return { success: false, error: 'Request not found.' };
  const match = await loadMatch(request.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  await authorizeForMatch(params.schoolId, match);

  const status = request.status as RescheduleStatus;
  if (!canCancelRequest(status)) return { success: false, error: NO_LONGER_CANCELLABLE };
  // Before the opponent answers it is the requester's request to withdraw. After a counter-offer
  // nobody has agreed to anything, so either school may walk away (see canCancelRequest).
  if (status === 'pending_opponent' && params.schoolId !== request.requestedBySchoolId) {
    return { success: false, error: 'Only the school that made the request can cancel it.' };
  }

  const updated = await db
    .update(schema.matchRescheduleRequests)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(schema.matchRescheduleRequests.id, request.id),
        // The status read above, re-checked in the write so a simultaneous agreement wins.
        eq(schema.matchRescheduleRequests.status, status)
      )
    )
    .returning({ id: schema.matchRescheduleRequests.id });
  return updated.length ? { success: true } : { success: false, error: NO_LONGER_CANCELLABLE };
}

export async function requestReschedule(
  params: RequestRescheduleParams
): Promise<RescheduleActionResult> {
  return withActionErrors(() => requestRescheduleImpl(params));
}

export async function respondToReschedule(
  params: RespondToRescheduleParams
): Promise<RescheduleActionResult> {
  return withActionErrors(() => respondToRescheduleImpl(params));
}

export async function counterReschedule(
  params: CounterRescheduleParams
): Promise<RescheduleActionResult> {
  return withActionErrors(() => counterRescheduleImpl(params));
}

export async function cancelReschedule(
  params: CancelRescheduleParams
): Promise<RescheduleActionResult> {
  return withActionErrors(() => cancelRescheduleImpl(params));
}
