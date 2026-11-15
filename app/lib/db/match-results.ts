import 'server-only';
import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { db } from './index';
import { dbErrorChain } from '../text-utils';
import * as schema from './schema';
import { normalizeRiotId, type RosterRiotIds, type SeriesResult } from '../match-results/series';
import { throttleDecision, USER_WINDOW_MS, type ThrottleDecision } from '../match-results/throttle';
import type { GameRepository } from '../match-results/resolve-series';
import type { NormalizedGame, NormalizedPlayer, TeamSide } from '../match-results/types';

/** The Riot IDs known for one roster: in-game names entered on it plus verified Riot identities. */
async function rosterRiotIds(rosterId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      role: schema.players.role,
      ign: schema.players.ign,
      riotId: schema.playerIdentities.providerUserId,
    })
    .from(schema.players)
    .leftJoin(
      schema.playerIdentities,
      and(
        eq(schema.playerIdentities.memberId, schema.players.memberId),
        eq(schema.playerIdentities.provider, 'riot')
      )
    )
    .where(eq(schema.players.rosterId, rosterId));

  const keys = new Set<string>();
  for (const row of rows) {
    if (row.role === 'coach') continue; // coaches do not play
    for (const raw of [row.ign, row.riotId]) {
      const value = raw?.trim();
      if (value && value.includes('#')) keys.add(normalizeRiotId(value));
    }
  }
  return keys;
}

export async function getMatchRosterRiotIds(homeRosterId: string, awayRosterId: string): Promise<RosterRiotIds> {
  const [home, away] = await Promise.all([rosterRiotIds(homeRosterId), rosterRiotIds(awayRosterId)]);
  return { home, away };
}

type GameRow = typeof schema.valorantGames.$inferSelect;
type PlayerRow = typeof schema.valorantGamePlayers.$inferSelect;

function toNormalizedPlayer(row: PlayerRow): NormalizedPlayer {
  return {
    puuid: row.puuid,
    name: row.name,
    tag: row.tag,
    side: row.side as TeamSide,
    agent: row.agent,
    tier: row.tier,
    score: row.score,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    headshots: row.headshots,
    bodyshots: row.bodyshots,
    legshots: row.legshots,
    damageDealt: row.damageDealt,
    damageReceived: row.damageReceived,
    isMatchMvp: row.isMatchMvp,
    isTeamMvp: row.isTeamMvp,
  };
}

function toNormalizedGame(game: GameRow, players: PlayerRow[]): NormalizedGame {
  return {
    matchId: game.riotMatchId,
    mapId: game.mapId,
    mapName: game.mapName,
    startedAt: game.startedAt,
    gameLengthMs: game.gameLengthMs,
    queueId: game.queueId,
    isCompleted: true, // only completed games with a winner are stored
    gameVersion: game.gameVersion,
    redRounds: game.redRounds,
    blueRounds: game.blueRounds,
    winningSide: game.winningSide as TeamSide,
    endedEarly: false, // such games are refused before they are stored
    players: players.map(toNormalizedPlayer),
  };
}

/** Postgres unique_violation, which drizzle may wrap so the code sits on `.cause`. */
export function isUniqueViolation(error: unknown): boolean {
  return dbErrorChain(error).some((e) => (e as { code?: unknown })?.code === '23505');
}

export const gameRepository: GameRepository = {
  async findStored(matchIds) {
    const result = new Map<string, NormalizedGame>();
    if (matchIds.length === 0) return result;
    const games = await db
      .select()
      .from(schema.valorantGames)
      .where(inArray(schema.valorantGames.riotMatchId, matchIds));
    if (games.length === 0) return result;
    const players = await db
      .select()
      .from(schema.valorantGamePlayers)
      .where(inArray(schema.valorantGamePlayers.gameId, games.map((g) => g.id)));
    for (const game of games) {
      result.set(
        game.riotMatchId,
        toNormalizedGame(game, players.filter((p) => p.gameId === game.id))
      );
    }
    return result;
  },

  async store(game) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.valorantGames)
        .values({
          riotMatchId: game.matchId,
          mapId: game.mapId,
          mapName: game.mapName,
          startedAt: game.startedAt,
          gameLengthMs: game.gameLengthMs,
          queueId: game.queueId,
          gameVersion: game.gameVersion,
          redRounds: game.redRounds,
          blueRounds: game.blueRounds,
          winningSide: game.winningSide as TeamSide,
        })
        .onConflictDoNothing()
        .returning({ id: schema.valorantGames.id });
      if (!row) return; // stored concurrently by another submission
      await tx.insert(schema.valorantGamePlayers).values(
        game.players.map((p) => ({
          gameId: row.id,
          puuid: p.puuid,
          name: p.name,
          tag: p.tag,
          side: p.side,
          agent: p.agent,
          tier: p.tier,
          score: p.score,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          headshots: p.headshots,
          bodyshots: p.bodyshots,
          legshots: p.legshots,
          damageDealt: p.damageDealt,
          damageReceived: p.damageReceived,
          isMatchMvp: p.isMatchMvp,
          isTeamMvp: p.isTeamMvp,
        }))
      );
    });
  },

  async findAttachments(matchIds) {
    const result = new Map<string, string>();
    if (matchIds.length === 0) return result;
    const rows = await db
      .select({ riotMatchId: schema.valorantGames.riotMatchId, matchId: schema.matchGames.matchId })
      .from(schema.matchGames)
      .innerJoin(schema.valorantGames, eq(schema.matchGames.gameId, schema.valorantGames.id))
      .where(inArray(schema.valorantGames.riotMatchId, matchIds));
    for (const row of rows) result.set(row.riotMatchId, row.matchId);
    return result;
  },
};

export interface SavedSeries {
  matchId: string;
  series: SeriesResult;
}

/**
 * Attaches the games to the league match and records the series score and status in one
 * transaction, replacing any earlier attachment for this match. The score is the number of maps
 * each roster won, written to the same `home_score` / `away_score` columns manual reporting uses.
 * Returns false when the match was completed by someone else since the caller looked.
 */
export async function saveSeriesResult(params: {
  matchId: string;
  series: SeriesResult;
}): Promise<boolean> {
  const { matchId, series } = params;
  const riotIds = series.games.map((g) => g.matchId);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: schema.matches.status, homeScore: schema.matches.homeScore })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .for('update');
    if (!current || current.status === 'cancelled' || current.status === 'forfeit') return false;
    // The caller checked this before fetching; re-check under the lock so two submissions (or a
    // staff score entry) racing each other cannot overwrite a result that landed in between.
    if (current.status === 'completed' || current.homeScore !== null) return false;

    const stored = await tx
      .select({ id: schema.valorantGames.id, riotMatchId: schema.valorantGames.riotMatchId })
      .from(schema.valorantGames)
      .where(inArray(schema.valorantGames.riotMatchId, riotIds));
    const idByRiot = new Map(stored.map((g) => [g.riotMatchId, g.id]));
    if (series.games.some((g) => !idByRiot.has(g.matchId))) {
      throw new Error('A game of the series was not stored.');
    }

    await tx.delete(schema.matchGames).where(eq(schema.matchGames.matchId, matchId));
    await tx.insert(schema.matchGames).values(
      series.games.map((g) => ({
        matchId,
        gameId: idByRiot.get(g.matchId)!,
        gameNumber: g.gameNumber,
        homeSide: g.homeSide,
        homeRounds: g.homeRounds,
        awayRounds: g.awayRounds,
      }))
    );
    await tx
      .update(schema.matches)
      .set({ homeScore: series.homeWins, awayScore: series.awayWins, status: 'completed' })
      .where(eq(schema.matches.id, matchId));
    await tx
      .update(schema.matchResultSubmissions)
      .set({ status: 'completed', lastError: null, retryAfter: null })
      .where(
        and(eq(schema.matchResultSubmissions.matchId, matchId), eq(schema.matchResultSubmissions.status, 'pending'))
      );
    return true;
  });
}

/** Number of stored games per league match, for the portal list. */
export async function getGameCounts(matchIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (matchIds.length === 0) return counts;
  const rows = await db
    .select({ matchId: schema.matchGames.matchId })
    .from(schema.matchGames)
    .where(inArray(schema.matchGames.matchId, matchIds));
  for (const row of rows) counts.set(row.matchId, (counts.get(row.matchId) ?? 0) + 1);
  return counts;
}

export interface PendingSubmissionItem {
  id: string;
  matchId: string;
  matchIds: string[];
  /** How many of the submitted games are already stored (fetched), not how many were pasted. */
  storedCount: number;
  /** ISO time before which a retry is pointless, when the service gave one. */
  retryAfter: string | null;
  message: string | null;
}

export async function getPendingSubmissions(matchIds: string[]): Promise<Map<string, PendingSubmissionItem>> {
  const result = new Map<string, PendingSubmissionItem>();
  if (matchIds.length === 0) return result;
  const rows = await db
    .select()
    .from(schema.matchResultSubmissions)
    .where(
      and(
        inArray(schema.matchResultSubmissions.matchId, matchIds),
        eq(schema.matchResultSubmissions.status, 'pending')
      )
    );
  const allIds = [...new Set(rows.flatMap((r) => r.riotMatchIds))];
  const storedIds = new Set(
    allIds.length === 0
      ? []
      : (
          await db
            .select({ riotMatchId: schema.valorantGames.riotMatchId })
            .from(schema.valorantGames)
            .where(inArray(schema.valorantGames.riotMatchId, allIds))
        ).map((g) => g.riotMatchId)
  );
  for (const row of rows) {
    result.set(row.matchId, {
      id: row.id,
      matchId: row.matchId,
      matchIds: row.riotMatchIds,
      storedCount: row.riotMatchIds.filter((id) => storedIds.has(id)).length,
      retryAfter: row.retryAfter ? row.retryAfter.toISOString() : null,
      message: row.lastError,
    });
  }
  return result;
}

/** Creates or refreshes the single open pending submission for a match. */
export async function upsertPendingSubmission(params: {
  matchId: string;
  userId: string;
  schoolId: string;
  riotMatchIds: string[];
  retryAfter: Date | null;
  message: string;
}): Promise<void> {
  const values = {
    riotMatchIds: params.riotMatchIds,
    retryAfter: params.retryAfter,
    lastError: params.message,
    submittedByUserId: params.userId,
    submittedBySchoolId: params.schoolId,
  };
  const updated = await db
    .update(schema.matchResultSubmissions)
    .set(values)
    .where(
      and(
        eq(schema.matchResultSubmissions.matchId, params.matchId),
        eq(schema.matchResultSubmissions.status, 'pending')
      )
    )
    .returning({ id: schema.matchResultSubmissions.id });
  if (updated.length > 0) return;
  try {
    await db.insert(schema.matchResultSubmissions).values({ matchId: params.matchId, ...values });
  } catch (error) {
    // Another submission for this match created the single open row between our update and
    // insert; refresh that row instead of failing.
    if (!isUniqueViolation(error)) throw error;
    await db
      .update(schema.matchResultSubmissions)
      .set(values)
      .where(
        and(
          eq(schema.matchResultSubmissions.matchId, params.matchId),
          eq(schema.matchResultSubmissions.status, 'pending')
        )
      );
  }
}

export async function cancelPendingSubmission(matchId: string): Promise<void> {
  await db
    .update(schema.matchResultSubmissions)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(schema.matchResultSubmissions.matchId, matchId),
        eq(schema.matchResultSubmissions.status, 'pending')
      )
    );
}

export async function getPendingSubmissionForMatch(matchId: string) {
  const [row] = await db
    .select()
    .from(schema.matchResultSubmissions)
    .where(
      and(
        eq(schema.matchResultSubmissions.matchId, matchId),
        eq(schema.matchResultSubmissions.status, 'pending')
      )
    )
    .limit(1);
  return row ?? null;
}

// ---- Scoreboard (match detail) ----

export interface ScoreboardPlayer extends NormalizedPlayer {
  acs: number;
  kdRatio: number;
  headshotPct: number;
}

export interface ScoreboardTeam {
  slot: 'home' | 'away';
  side: TeamSide;
  schoolName: string;
  rounds: number;
  won: boolean;
  players: ScoreboardPlayer[];
}

export interface ScoreboardGame {
  gameNumber: number;
  mapName: string;
  startedAt: string;
  rounds: number;
  teams: [ScoreboardTeam, ScoreboardTeam];
}

export interface MatchScoreboard {
  matchId: string;
  homeSchoolName: string;
  awaySchoolName: string;
  homeWins: number;
  awayWins: number;
  games: ScoreboardGame[];
}

/** Average combat score: round-normalized total score. */
export function acsOf(score: number, rounds: number): number {
  return rounds > 0 ? Math.round(score / rounds) : 0;
}

export function headshotPctOf(p: Pick<NormalizedPlayer, 'headshots' | 'bodyshots' | 'legshots'>): number {
  const shots = p.headshots + p.bodyshots + p.legshots;
  return shots > 0 ? Math.round((p.headshots / shots) * 100) : 0;
}

/** Everything the scoreboard dialog shows for one league match, or null when it has no games. */
export async function getMatchScoreboard(
  matchId: string,
  names: { homeSchoolName: string; awaySchoolName: string }
): Promise<MatchScoreboard | null> {
  const links = await db
    .select({
      gameNumber: schema.matchGames.gameNumber,
      homeSide: schema.matchGames.homeSide,
      homeRounds: schema.matchGames.homeRounds,
      awayRounds: schema.matchGames.awayRounds,
      gameId: schema.valorantGames.id,
      mapName: schema.valorantGames.mapName,
      startedAt: schema.valorantGames.startedAt,
    })
    .from(schema.matchGames)
    .innerJoin(schema.valorantGames, eq(schema.matchGames.gameId, schema.valorantGames.id))
    .where(eq(schema.matchGames.matchId, matchId))
    .orderBy(asc(schema.matchGames.gameNumber));
  if (links.length === 0) return null;

  const players = await db
    .select()
    .from(schema.valorantGamePlayers)
    .where(inArray(schema.valorantGamePlayers.gameId, links.map((l) => l.gameId)))
    .orderBy(desc(schema.valorantGamePlayers.score));

  let homeWins = 0;
  let awayWins = 0;
  const games: ScoreboardGame[] = links.map((link) => {
    const rounds = link.homeRounds + link.awayRounds;
    const homeSide = link.homeSide as TeamSide;
    const awaySide: TeamSide = homeSide === 'Red' ? 'Blue' : 'Red';
    const homeWon = link.homeRounds > link.awayRounds;
    if (homeWon) homeWins += 1;
    else awayWins += 1;
    const forSide = (side: TeamSide): ScoreboardPlayer[] =>
      players
        .filter((p) => p.gameId === link.gameId && p.side === side)
        .map((row) => {
          const p = toNormalizedPlayer(row);
          return {
            ...p,
            acs: acsOf(p.score, rounds),
            kdRatio: p.deaths > 0 ? Math.round((p.kills / p.deaths) * 100) / 100 : p.kills,
            headshotPct: headshotPctOf(p),
          };
        });
    return {
      gameNumber: link.gameNumber,
      mapName: link.mapName,
      startedAt: link.startedAt.toISOString(),
      rounds,
      teams: [
        { slot: 'home', side: homeSide, schoolName: names.homeSchoolName, rounds: link.homeRounds, won: homeWon, players: forSide(homeSide) },
        { slot: 'away', side: awaySide, schoolName: names.awaySchoolName, rounds: link.awayRounds, won: !homeWon, players: forSide(awaySide) },
      ],
    };
  });
  return { matchId, homeSchoolName: names.homeSchoolName, awaySchoolName: names.awaySchoolName, homeWins, awayWins, games };
}

/**
 * Applies the fresh-submission limits and, when allowed, records the attempt, atomically: the
 * match and the user are each serialized with a transaction advisory lock, so two concurrent
 * submissions cannot both pass the check. Timestamps are written explicitly from `now` (never the
 * database clock) so the comparison does not depend on the server's timezone.
 */
export async function reserveSubmissionAttempt(params: {
  matchId: string;
  userId: string;
  now?: Date;
}): Promise<ThrottleDecision> {
  const now = params.now ?? new Date();
  return db.transaction(async (tx) => {
    // Always lock the match first, then the user, so concurrent callers cannot deadlock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'match-result:match:' + params.matchId}, 0))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'match-result:user:' + params.userId}, 0))`);

    // Rows older than the one-hour window can no longer affect either limit, so drop them here
    // instead of running a separate cleanup job.
    await tx
      .delete(schema.matchResultAttempts)
      .where(lt(schema.matchResultAttempts.createdAt, new Date(now.getTime() - USER_WINDOW_MS)));

    const [last] = await tx
      .select({ createdAt: schema.matchResultAttempts.createdAt })
      .from(schema.matchResultAttempts)
      .where(eq(schema.matchResultAttempts.matchId, params.matchId))
      .orderBy(desc(schema.matchResultAttempts.createdAt))
      .limit(1);
    const userRows = await tx
      .select({ createdAt: schema.matchResultAttempts.createdAt })
      .from(schema.matchResultAttempts)
      .where(
        and(
          eq(schema.matchResultAttempts.userId, params.userId),
          gt(schema.matchResultAttempts.createdAt, new Date(now.getTime() - USER_WINDOW_MS))
        )
      );

    const decision = throttleDecision({
      now,
      lastForMatch: last?.createdAt ?? null,
      userAttempts: userRows.map((r) => r.createdAt),
    });
    if (decision.ok) {
      await tx.insert(schema.matchResultAttempts).values({ matchId: params.matchId, userId: params.userId, createdAt: now });
    }
    return decision;
  });
}
