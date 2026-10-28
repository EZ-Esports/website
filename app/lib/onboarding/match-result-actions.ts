'use server';

import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { revalidatePath, updateTag } from 'next/cache';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import {
  cancelPendingSubmission,
  gameRepository,
  isUniqueViolation,
  getMatchRosterRiotIds,
  getMatchScoreboard,
  getPendingSubmissionForMatch,
  reserveSubmissionAttempt,
  saveSeriesResult,
  upsertPendingSubmission,
  type MatchScoreboard,
} from '@/app/lib/db/match-results';
import { parseMatchReferences } from '@/app/lib/match-results/parse-match-ref';
import { resolveSeries } from '@/app/lib/match-results/resolve-series';
import { getMatchDataPort } from '@/app/lib/match-results/server';
import { DEFAULT_RETRY_SECONDS } from '@/app/lib/match-results/henrik-adapter';
import { assertManagerForSchoolGame } from './manager-auth';

/** The game whose results this feature can fetch. */
const SUPPORTED_GAME_SLUG = 'valorant';

export interface MatchResultActionResult {
  success: boolean;
  /** One summary line, safe to show. */
  error?: string;
  /** Per-game problems when the submission was refused. */
  errors?: string[];
  /** The data service was busy or down: the IDs are saved and "Check again" retries them. */
  pending?: boolean;
  /** Set on success: the series as home-away maps won, from the submitting school's side. */
  summary?: string;
}

class ActionError extends Error {}

const homeRoster = alias(schema.rosters, 'home_roster');
const awayRoster = alias(schema.rosters, 'away_roster');
const homeTeam = alias(schema.teams, 'home_team');
const awayTeam = alias(schema.teams, 'away_team');
const homeSchool = alias(schema.schools, 'home_school');
const awaySchool = alias(schema.schools, 'away_school');

async function loadMatch(matchId: string) {
  const [match] = await db
    .select({
      id: schema.matches.id,
      seasonId: schema.matches.seasonId,
      gameId: schema.seasons.gameId,
      gameSlug: schema.games.slug,
      status: schema.matches.status,
      scheduledAt: schema.matches.scheduledAt,
      homeScore: schema.matches.homeScore,
      homeRosterId: schema.matches.homeRosterId,
      awayRosterId: schema.matches.awayRosterId,
      homeSchoolId: homeTeam.schoolId,
      homeSchoolName: homeSchool.name,
      awaySchoolId: awayTeam.schoolId,
      awaySchoolName: awaySchool.name,
    })
    .from(schema.matches)
    .innerJoin(schema.seasons, eq(schema.matches.seasonId, schema.seasons.id))
    .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
    .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
    .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
    .innerJoin(homeSchool, eq(homeTeam.schoolId, homeSchool.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
    .innerJoin(awaySchool, eq(awayTeam.schoolId, awaySchool.id))
    .where(eq(schema.matches.id, matchId))
    .limit(1);
  return match ?? null;
}

type LoadedMatch = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

/**
 * Authorizes the caller for one side of this match: a manager of either school for the match's
 * game in the match's own season (a write, so an inactive season is refused when `write`), or a
 * staff admin acting for one of the two schools.
 */
async function authorizeForMatch(
  schoolId: string,
  match: LoadedMatch,
  write: boolean
): Promise<{ userId: string }> {
  if (match.homeSchoolId !== schoolId && match.awaySchoolId !== schoolId) {
    throw new ActionError('Your school is not playing in this match.');
  }
  let authorized: Awaited<ReturnType<typeof assertManagerForSchoolGame>>;
  try {
    authorized = await assertManagerForSchoolGame(schoolId, match.gameId, { allowInactive: !write });
  } catch (error) {
    throw new ActionError(error instanceof Error ? error.message : 'You cannot do this.');
  }
  const { context, season } = authorized;
  if (!context.isStaffAdmin && (!season || season.id !== match.seasonId)) {
    throw new ActionError('This match is not in your season.');
  }
  return { userId: context.userId };
}

async function withActionErrors<T extends { success: boolean }>(
  run: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ActionError) return { ...fallback, success: false, error: error.message };
    console.error('Match result action failed', error);
    return { ...fallback, success: false, error: 'Something went wrong. Please try again.' };
  }
}

function revalidateResults() {
  updateTag('matches');
  updateTag('rosters');
  updateTag('teams');
  revalidatePath('/portal');
  revalidatePath('/admin/matches');
}

/** Why a match cannot take a fetched result, or null when it can. */
async function refusalFor(match: LoadedMatch): Promise<string | null> {
  if (match.gameSlug !== SUPPORTED_GAME_SLUG) return 'Results can only be fetched automatically for Valorant.';
  if (match.status === 'cancelled' || match.status === 'forfeit') {
    return 'This match was cancelled or forfeited, so it cannot take a played result.';
  }
  if (match.status === 'completed' || match.homeScore !== null) {
    return 'This match already has a result. Ask EZ Esports staff if it needs to change.';
  }
  return null;
}

async function submit(
  match: LoadedMatch,
  schoolId: string,
  userId: string,
  matchIds: string[]
): Promise<MatchResultActionResult> {
  const rosters = await getMatchRosterRiotIds(match.homeRosterId, match.awayRosterId);
  const outcome = await resolveSeries({
    leagueMatchId: match.id,
    matchIds,
    rosters,
    scheduledAt: match.scheduledAt,
    port: getMatchDataPort(),
    repo: gameRepository,
  });

  if (outcome.status === 'invalid') {
    return { success: false, error: 'This result could not be accepted.', errors: outcome.errors };
  }

  if (outcome.status === 'pending') {
    const seconds = outcome.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS;
    try {
      await upsertPendingSubmission({
        matchId: match.id,
        userId,
        schoolId,
        riotMatchIds: matchIds,
        retryAfter: new Date(Date.now() + seconds * 1000),
        message: outcome.message,
      });
    } catch (error) {
      console.error('Failed to save pending match result', error);
      return { success: false, error: 'The match data service is busy and your IDs could not be saved. Try again shortly.' };
    }
    revalidatePath('/portal');
    return {
      success: false,
      pending: true,
      error: 'The match data service is busy. Your match IDs are saved; check again in a minute.',
    };
  }

  let saved: boolean;
  try {
    saved = await saveSeriesResult({ matchId: match.id, series: outcome.series });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The unique index on a game's id: another match claimed one of these games first.
      return { success: false, error: 'One of these games is already counted for another match.' };
    }
    console.error('Failed to save series result', error);
    return { success: false, error: 'Could not save the result. Please try again.' };
  }
  if (!saved) return { success: false, error: 'This match can no longer take a result.' };
  revalidateResults();

  const own = schoolId === match.homeSchoolId ? 'home' : 'away';
  const mine = own === 'home' ? outcome.series.homeWins : outcome.series.awayWins;
  const theirs = own === 'home' ? outcome.series.awayWins : outcome.series.homeWins;
  return { success: true, summary: `${mine}-${theirs}` };
}

export interface SubmitMatchResultParams {
  matchId: string;
  schoolId: string;
  /** Pasted match IDs and/or tracker.gg links, one per game. */
  input: string;
}

async function submitMatchResultImpl(params: SubmitMatchResultParams): Promise<MatchResultActionResult> {
  // Malformed input never reaches the API.
  const parsed = parseMatchReferences(params.input ?? '');
  if (parsed.errors.length > 0) {
    return { success: false, error: 'Check the match IDs.', errors: parsed.errors };
  }
  const match = await loadMatch(params.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  const { userId } = await authorizeForMatch(params.schoolId, match, true);
  const refusal = await refusalFor(match);
  if (refusal) return { success: false, error: refusal };
  // Fresh submissions only: "Check again" (retryMatchResult) reuses ids already paid for.
  const allowed = await reserveSubmissionAttempt({ matchId: match.id, userId });
  if (!allowed.ok) return { success: false, error: allowed.message };
  return submit(match, params.schoolId, userId, parsed.ids);
}

export async function submitMatchResult(params: SubmitMatchResultParams): Promise<MatchResultActionResult> {
  return withActionErrors(() => submitMatchResultImpl(params), { success: false });
}

export interface PendingResultParams {
  matchId: string;
  schoolId: string;
}

async function retryMatchResultImpl(params: PendingResultParams): Promise<MatchResultActionResult> {
  const match = await loadMatch(params.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  const { userId } = await authorizeForMatch(params.schoolId, match, true);
  const pending = await getPendingSubmissionForMatch(match.id);
  if (!pending) return { success: false, error: 'There is nothing waiting for this match.' };
  const refusal = await refusalFor(match);
  if (refusal) return { success: false, error: refusal };
  // Honour the service's own wait so "Check again" cannot be used to hammer a rate limit.
  if (pending.retryAfter && pending.retryAfter.getTime() > Date.now()) {
    return { success: false, pending: true, error: 'The match data service asked us to wait. Try again shortly.' };
  }
  return submit(match, params.schoolId, userId, pending.riotMatchIds);
}

export async function retryMatchResult(params: PendingResultParams): Promise<MatchResultActionResult> {
  return withActionErrors(() => retryMatchResultImpl(params), { success: false });
}

async function cancelPendingResultImpl(params: PendingResultParams): Promise<MatchResultActionResult> {
  const match = await loadMatch(params.matchId);
  if (!match) return { success: false, error: 'Match not found.' };
  await authorizeForMatch(params.schoolId, match, true);
  await cancelPendingSubmission(match.id);
  revalidatePath('/portal');
  return { success: true };
}

export async function cancelPendingResult(params: PendingResultParams): Promise<MatchResultActionResult> {
  return withActionErrors(() => cancelPendingResultImpl(params), { success: false });
}

export type ScoreboardResult =
  | { success: true; scoreboard: MatchScoreboard }
  | { success: false; error: string };

/**
 * The tracker-style scoreboard for a match. Only the two schools' managers (and staff admins)
 * may open it: the portal list redacts scores until staff publish the season (spec-022), but the
 * managers played these games and submitted them, so their own scoreboard is not hidden from them.
 * A view-only (past) season can still be read.
 */
export async function getMatchScoreboardAction(params: PendingResultParams): Promise<ScoreboardResult> {
  try {
    const match = await loadMatch(params.matchId);
    if (!match) return { success: false, error: 'Match not found.' };
    await authorizeForMatch(params.schoolId, match, false);
    const scoreboard = await getMatchScoreboard(match.id, {
      homeSchoolName: match.homeSchoolName,
      awaySchoolName: match.awaySchoolName,
    });
    if (!scoreboard) return { success: false, error: 'This match has no game stats.' };
    return { success: true, scoreboard };
  } catch (error) {
    if (error instanceof ActionError) return { success: false, error: error.message };
    console.error('Failed to load scoreboard', error);
    return { success: false, error: 'Could not load the scoreboard.' };
  }
}
