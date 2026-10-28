import 'server-only';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './index';
import * as schema from './schema';
import {
  hasUsedRescheduleAllowance,
  type RescheduleRequestItem,
  type RescheduleStatus,
  type StaffRescheduleItem,
} from '../reschedule-rules';

const homeRoster = alias(schema.rosters, 'home_roster');
const awayRoster = alias(schema.rosters, 'away_roster');
const homeTeam = alias(schema.teams, 'home_team');
const awayTeam = alias(schema.teams, 'away_team');
const homeSchool = alias(schema.schools, 'home_school');
const awaySchool = alias(schema.schools, 'away_school');
const requesterSchool = alias(schema.schools, 'requester_school');

/**
 * The most recent request for each match, with its proposed times. A match can have many
 * resolved requests over time but at most one open one (a unique index), so the latest by
 * creation is the open one when there is one. Matches without a request are absent.
 */
export async function getLatestRescheduleRequests(
  matchIds: string[]
): Promise<Map<string, RescheduleRequestItem>> {
  const latest = new Map<string, RescheduleRequestItem>();
  if (matchIds.length === 0) return latest;

  const rows = await db
    .select({
      id: schema.matchRescheduleRequests.id,
      matchId: schema.matchRescheduleRequests.matchId,
      status: schema.matchRescheduleRequests.status,
      isLate: schema.matchRescheduleRequests.isLate,
      reason: schema.matchRescheduleRequests.reason,
      requestedBySchoolId: schema.matchRescheduleRequests.requestedBySchoolId,
      requestedBySchoolName: requesterSchool.name,
      originalScheduledAt: schema.matchRescheduleRequests.originalScheduledAt,
      acceptedOptionId: schema.matchRescheduleRequests.acceptedOptionId,
      staffNote: schema.matchRescheduleRequests.staffNote,
      createdAt: schema.matchRescheduleRequests.createdAt,
    })
    .from(schema.matchRescheduleRequests)
    .innerJoin(requesterSchool, eq(schema.matchRescheduleRequests.requestedBySchoolId, requesterSchool.id))
    .where(inArray(schema.matchRescheduleRequests.matchId, matchIds))
    .orderBy(desc(schema.matchRescheduleRequests.createdAt), desc(schema.matchRescheduleRequests.id));

  const picked = rows.filter((row) => {
    if (latest.has(row.matchId)) return false;
    latest.set(row.matchId, {
      id: row.id,
      matchId: row.matchId,
      status: row.status as RescheduleStatus,
      isLate: row.isLate,
      reason: row.reason,
      requestedBySchoolId: row.requestedBySchoolId,
      requestedBySchoolName: row.requestedBySchoolName,
      originalScheduledAt: row.originalScheduledAt.toISOString(),
      options: [],
      acceptedOptionId: row.acceptedOptionId,
      staffNote: row.staffNote,
      createdAt: row.createdAt.toISOString(),
    });
    return true;
  });
  if (picked.length === 0) return latest;

  const options = await db
    .select()
    .from(schema.matchRescheduleOptions)
    .where(inArray(schema.matchRescheduleOptions.requestId, picked.map((r) => r.id)))
    .orderBy(schema.matchRescheduleOptions.proposedAt);
  const byRequest = new Map(picked.map((r) => [r.id, latest.get(r.matchId)!]));
  for (const option of options) {
    byRequest.get(option.requestId)?.options.push({
      id: option.id,
      proposedAt: option.proposedAt.toISOString(),
      proposedBy: option.proposedBy === 'opponent' ? 'opponent' : 'requester',
    });
  }
  return latest;
}

/**
 * For each match staff have moved, the time it moved from (ISO), taken from its most recent
 * approved request. Kept apart from `getLatestRescheduleRequests` so the "rescheduled" marker
 * survives a later request being declined or cancelled.
 */
export async function getRescheduledFrom(matchIds: string[]): Promise<Map<string, string>> {
  const movedFrom = new Map<string, string>();
  if (matchIds.length === 0) return movedFrom;

  const rows = await db
    .select({
      matchId: schema.matchRescheduleRequests.matchId,
      originalScheduledAt: schema.matchRescheduleRequests.originalScheduledAt,
    })
    .from(schema.matchRescheduleRequests)
    .where(
      and(
        inArray(schema.matchRescheduleRequests.matchId, matchIds),
        eq(schema.matchRescheduleRequests.status, 'approved')
      )
    )
    .orderBy(desc(schema.matchRescheduleRequests.decidedAt), desc(schema.matchRescheduleRequests.id));
  for (const row of rows) {
    if (!movedFrom.has(row.matchId)) movedFrom.set(row.matchId, row.originalScheduledAt.toISOString());
  }
  return movedFrom;
}

/** Requests the opponent has accepted and staff still have to approve or decline, oldest first. */
export async function getStaffRescheduleQueue(): Promise<StaffRescheduleItem[]> {
  const rows = await db
    .select({
      id: schema.matchRescheduleRequests.id,
      matchId: schema.matchRescheduleRequests.matchId,
      isLate: schema.matchRescheduleRequests.isLate,
      reason: schema.matchRescheduleRequests.reason,
      requestedBySchoolName: requesterSchool.name,
      homeSchoolName: homeSchool.name,
      awaySchoolName: awaySchool.name,
      gameName: schema.games.displayName,
      seasonName: schema.seasons.name,
      currentScheduledAt: schema.matches.scheduledAt,
      newScheduledAt: schema.matchRescheduleOptions.proposedAt,
      createdAt: schema.matchRescheduleRequests.createdAt,
    })
    .from(schema.matchRescheduleRequests)
    .innerJoin(schema.matches, eq(schema.matchRescheduleRequests.matchId, schema.matches.id))
    .innerJoin(
      schema.matchRescheduleOptions,
      eq(schema.matchRescheduleRequests.acceptedOptionId, schema.matchRescheduleOptions.id)
    )
    .innerJoin(schema.seasons, eq(schema.matches.seasonId, schema.seasons.id))
    .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
    .innerJoin(requesterSchool, eq(schema.matchRescheduleRequests.requestedBySchoolId, requesterSchool.id))
    .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
    .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
    .innerJoin(homeSchool, eq(homeTeam.schoolId, homeSchool.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
    .innerJoin(awaySchool, eq(awayTeam.schoolId, awaySchool.id))
    .where(
      and(
        eq(schema.matchRescheduleRequests.status, 'pending_staff'),
        isNull(homeSchool.deletedAt),
        isNull(awaySchool.deletedAt)
      )
    )
    .orderBy(schema.matchRescheduleRequests.createdAt, schema.matchRescheduleRequests.id);

  return rows.map((row) => ({
    ...row,
    currentScheduledAt: row.currentScheduledAt.toISOString(),
    newScheduledAt: row.newScheduledAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * The seasons (of those given) in which a school has used up its reschedule allowance: its
 * requests in that season, cancelled ones excluded, reach `MAX_RESCHEDULE_REQUESTS_PER_SEASON`.
 * Same counting rule as the request action, which re-checks it under a lock before writing.
 */
export async function getSeasonsWithRescheduleAllowanceUsed(
  schoolId: string,
  seasonIds: string[]
): Promise<Set<string>> {
  const used = new Set<string>();
  if (seasonIds.length === 0) return used;

  const rows = await db
    .select({
      seasonId: schema.matches.seasonId,
      requests: sql<number>`count(*)::int`,
    })
    .from(schema.matchRescheduleRequests)
    .innerJoin(schema.matches, eq(schema.matchRescheduleRequests.matchId, schema.matches.id))
    .where(
      and(
        eq(schema.matchRescheduleRequests.requestedBySchoolId, schoolId),
        inArray(schema.matches.seasonId, seasonIds),
        ne(schema.matchRescheduleRequests.status, 'cancelled')
      )
    )
    .groupBy(schema.matches.seasonId);
  for (const row of rows) {
    if (hasUsedRescheduleAllowance(Number(row.requests))) used.add(row.seasonId);
  }
  return used;
}
