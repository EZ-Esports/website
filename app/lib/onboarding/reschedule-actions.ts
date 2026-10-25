'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { parseEastern } from '@/app/lib/dates';
import {
  MAX_REASON_LENGTH,
  canCancelRequest,
  canOpponentRespond,
  isLateRequest,
  validateProposedTimes,
  type RescheduleStatus,
} from '@/app/lib/reschedule-rules';
import { assertManagerForSchoolGame } from './manager-auth';

export type RescheduleActionResult = { success: boolean; error?: string };

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
 * Authorizes a manager to act for `schoolId` on this match: they must manage that school and the
 * match's game in the match's own season (a write, so an inactive season is refused), and the
 * school must be one of the two sides. Staff admins are refused: staff move matches from the
 * staff portal, and acting here would blur which side a request came from.
 */
async function authorizeForMatch(schoolId: string, match: LoadedMatch): Promise<{ userId: string }> {
  const { context, season } = await assertManagerForSchoolGame(schoolId, match.gameId);
  if (context.isStaffAdmin) {
    throw new Error('Staff review reschedules from the staff portal.');
  }
  if (!season || season.id !== match.seasonId) {
    throw new Error('Forbidden: this match is not in your season.');
  }
  if (match.homeSchoolId !== schoolId && match.awaySchoolId !== schoolId) {
    throw new Error('Forbidden: your school is not playing in this match.');
  }
  return { userId: context.userId };
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

export async function requestReschedule(
  params: RequestRescheduleParams
): Promise<RescheduleActionResult> {
  const reason = params.reason?.trim() ?? '';
  if (!reason) return { success: false, error: 'Explain why the match needs to move.' };
  if (reason.length > MAX_REASON_LENGTH) {
    return { success: false, error: `Keep the reason under ${MAX_REASON_LENGTH} characters.` };
  }

  const match = await loadMatch(params.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  const { userId } = await authorizeForMatch(params.schoolId, match);

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
  /** The responding (opposing) school. */
  schoolId: string;
  accept: boolean;
  /** Required when accepting: one of the request's proposed times. */
  optionId?: string;
}

export async function respondToReschedule(
  params: RespondToRescheduleParams
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
  if (match.status !== 'scheduled' || match.scheduledAt.getTime() !== request.originalScheduledAt.getTime()) {
    return { success: false, error: 'The match has changed since this request was made.' };
  }

  const now = new Date();
  const base = { opponentRespondedByUserId: userId, opponentRespondedAt: now };

  if (!params.accept) {
    const updated = await db
      .update(schema.matchRescheduleRequests)
      .set({ ...base, status: 'declined_opponent' })
      .where(
        and(
          eq(schema.matchRescheduleRequests.id, request.id),
          eq(schema.matchRescheduleRequests.status, 'pending_opponent')
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
        eq(schema.matchRescheduleOptions.requestId, request.id)
      )
    )
    .limit(1);
  if (!option) return { success: false, error: 'That time is not part of this request.' };
  if (option.proposedAt.getTime() <= now.getTime()) {
    return { success: false, error: 'That time has already passed. Choose another or decline.' };
  }

  const updated = await db
    .update(schema.matchRescheduleRequests)
    .set({ ...base, status: 'pending_staff', acceptedOptionId: option.id })
    .where(
      and(
        eq(schema.matchRescheduleRequests.id, request.id),
        eq(schema.matchRescheduleRequests.status, 'pending_opponent')
      )
    )
    .returning({ id: schema.matchRescheduleRequests.id });
  return updated.length
    ? { success: true }
    : { success: false, error: 'This request was already resolved.' };
}

export interface CancelRescheduleParams {
  requestId: string;
  /** The requesting school. */
  schoolId: string;
}

export async function cancelReschedule(
  params: CancelRescheduleParams
): Promise<RescheduleActionResult> {
  const request = await loadRequest(params.requestId);
  if (!request) return { success: false, error: 'Request not found.' };
  const match = await loadMatch(request.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  await authorizeForMatch(params.schoolId, match);

  if (params.schoolId !== request.requestedBySchoolId) {
    return { success: false, error: 'Only the school that made the request can cancel it.' };
  }
  if (!canCancelRequest(request.status as RescheduleStatus)) {
    return { success: false, error: 'The other school already agreed, so this can no longer be cancelled.' };
  }

  const updated = await db
    .update(schema.matchRescheduleRequests)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(schema.matchRescheduleRequests.id, request.id),
        inArray(schema.matchRescheduleRequests.status, ['pending_opponent'])
      )
    )
    .returning({ id: schema.matchRescheduleRequests.id });
  return updated.length
    ? { success: true }
    : { success: false, error: 'The other school already agreed, so this can no longer be cancelled.' };
}
