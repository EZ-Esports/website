import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias, unionAll } from 'drizzle-orm/pg-core';
import {
  COMBINED_DIVISION,
  canonicalDivision,
  clampPageLimit,
  normalizeSort,
  type CanonicalDivision,
  type HubDivision,
  type MatchesPage,
  type MatchesPageParams,
  type StandingsFormat,
} from './match-page';
import { FORM_LENGTH, buildFormGuide, type FormOutcome } from '@/app/lib/game-hub-form';
import { getActiveSeasonForGame, getSeasonsWithGames } from './league';
import { canonicalDivisionSql, hubDivisionSql, getGameSeasonSummary } from './standings';
import { canonicalGameSlug, dbGameSlug } from '../constants';

/** Default page size for public-facing paginated lists. */
export const DEFAULT_PAGE_SIZE = 20;

export const getCachedMatches = unstable_cache(
  async (limit = DEFAULT_PAGE_SIZE, offset = 0) => {
    return db
      .select()
      .from(schema.matches)
      .orderBy(desc(schema.matches.scheduledAt))
      .limit(limit)
      .offset(offset);
  },
  ['matches-list'],
  { tags: ['matches'] }
);

/** Uncached: returns all matches for staff views. */
export const getStaffMatches = () =>
  db.select().from(schema.matches).orderBy(desc(schema.matches.scheduledAt));

const homeRoster = alias(schema.rosters, 'home_roster');
const awayRoster = alias(schema.rosters, 'away_roster');
const homeTeam = alias(schema.teams, 'home_team');
const awayTeam = alias(schema.teams, 'away_team');
const homeSchool = alias(schema.schools, 'home_school');
const awaySchool = alias(schema.schools, 'away_school');

/**
 * Keyset-paginated match list with division + school names joined in.
 * Sorted by (scheduledAt, id); `cursor` is the sort key of the last row of
 * the previous page. Fetches one extra row to detect whether more remain.
 * Uncached: filter permutations are unbounded and admin edits must be fresh.
 */
export function buildMatchesPageQuery(params: MatchesPageParams) {
  const sort = normalizeSort(params.sort);
  const limit = clampPageLimit(params.limit, DEFAULT_PAGE_SIZE);

  const conditions = [];
  if (params.seasonId) conditions.push(eq(schema.matches.seasonId, params.seasonId));
  if (params.gameId) conditions.push(eq(schema.seasons.gameId, params.gameId));
  if (params.division && params.division !== COMBINED_DIVISION) {
    const targetDiv = canonicalDivision(params.division);
    conditions.push(
      or(
        eq(canonicalDivisionSql(homeRoster.division), targetDiv),
        eq(canonicalDivisionSql(awayRoster.division), targetDiv)
      )
    );
  }
  if (params.status) conditions.push(eq(schema.matches.status, params.status));
  if (params.from) conditions.push(gte(schema.matches.scheduledAt, params.from));
  if (params.to) conditions.push(lte(schema.matches.scheduledAt, params.to));
  if (params.search) {
    const pattern = `%${params.search.replace(/[%_\\]/g, '\\$&')}%`;
    conditions.push(or(ilike(homeSchool.name, pattern), ilike(awaySchool.name, pattern)));
  }
  if (params.cursor) {
    const ts = new Date(params.cursor.scheduledAt);
    const { id } = params.cursor;
    conditions.push(
      sort === 'desc'
        ? or(
            lt(schema.matches.scheduledAt, ts),
            and(eq(schema.matches.scheduledAt, ts), lt(schema.matches.id, id))
          )
        : or(
            gt(schema.matches.scheduledAt, ts),
            and(eq(schema.matches.scheduledAt, ts), gt(schema.matches.id, id))
          )
    );
  }

  const direction = sort === 'desc' ? desc : asc;
  return db
    .select({
      id: schema.matches.id,
      seasonId: schema.matches.seasonId,
      scheduledAt: schema.matches.scheduledAt,
      status: schema.matches.status,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      division: canonicalDivisionSql(homeRoster.division),
      homeTeam: homeSchool.name,
      awayTeam: awaySchool.name,
    })
    .from(schema.matches)
    .innerJoin(schema.seasons, eq(schema.matches.seasonId, schema.seasons.id))
    .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
    .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
    .innerJoin(homeSchool, eq(homeTeam.schoolId, homeSchool.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
    .innerJoin(awaySchool, eq(awayTeam.schoolId, awaySchool.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(direction(schema.matches.scheduledAt), direction(schema.matches.id))
    .limit(limit + 1);
}

export async function getMatchesPage(params: MatchesPageParams): Promise<MatchesPage> {
  const limit = clampPageLimit(params.limit, DEFAULT_PAGE_SIZE);
  const rows = await buildMatchesPageQuery({ ...params, limit });

  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? { scheduledAt: last.scheduledAt.toISOString(), id: last.id }
        : null,
  };
}

export function buildSeasonMatchesQuery(seasonId: string, division?: string) {
  const conditions = [eq(schema.matches.seasonId, seasonId)];
  if (division && division !== COMBINED_DIVISION) {
    const targetDiv = canonicalDivision(division);
    conditions.push(
      or(
        eq(canonicalDivisionSql(homeRoster.division), targetDiv),
        eq(canonicalDivisionSql(awayRoster.division), targetDiv)
      )!
    );
  }
  return db
    .select({
      id: schema.matches.id,
      seasonId: schema.matches.seasonId,
      scheduledAt: schema.matches.scheduledAt,
      status: schema.matches.status,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      division: canonicalDivisionSql(homeRoster.division),
      homeTeam: homeSchool.name,
      awayTeam: awaySchool.name,
    })
    .from(schema.matches)
    .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
    .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
    .innerJoin(homeSchool, eq(homeTeam.schoolId, homeSchool.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
    .innerJoin(awaySchool, eq(awayTeam.schoolId, awaySchool.id))
    .where(and(...conditions))
    .orderBy(asc(schema.matches.scheduledAt), asc(schema.matches.id));
}

/**
 * All matches of a season (optionally one division) with names joined in,
 * oldest first. Used by the calendar view, which needs the whole season.
 */
export async function getSeasonMatches(seasonId: string, division?: string) {
  return buildSeasonMatchesQuery(seasonId, division);
}

/** Count of all scheduled matches (for dashboard). */
export const countScheduledMatches = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.matches)
    .where(eq(schema.matches.status, 'scheduled'));
  return row?.value ?? 0;
};

/**
 * Count of past scheduled matches still missing a final score (dashboard alert).
 */
export const countPendingResults = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.status, 'scheduled'),
        lt(schema.matches.scheduledAt, new Date()),
        or(isNull(schema.matches.homeScore), isNull(schema.matches.awayScore))
      )
    );
  return row?.value ?? 0;
};

/** Latest matches with recorded results across all games (homepage pulse). */
export const getCachedRecentResults = unstable_cache(
  async () => {
    const rows = await db
      .select({
        id: schema.matches.id,
        scheduledAt: schema.matches.scheduledAt,
        status: schema.matches.status,
        homeScore: schema.matches.homeScore,
        awayScore: schema.matches.awayScore,
        division: homeRoster.division,
        homeTeam: homeSchool.name,
        awayTeam: awaySchool.name,
        gameSlug: schema.games.slug,
        gameShortName: schema.games.shortName,
        seasonName: schema.seasons.name,
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
      .where(
        and(
          inArray(schema.matches.status, ['completed', 'forfeit']),
          isNotNull(schema.matches.homeScore),
          isNotNull(schema.matches.awayScore),
          eq(homeSchool.isActive, true),
          eq(awaySchool.isActive, true),
          isNull(homeSchool.deletedAt),
          isNull(awaySchool.deletedAt)
        )
      )
      .orderBy(desc(schema.matches.scheduledAt), desc(schema.matches.id))
      .limit(3);
    return rows.map((r) => ({
      ...r,
      gameSlug: canonicalGameSlug(r.gameSlug),
      scheduledAt: r.scheduledAt.toISOString(),
    }));
  },
  ['recent-results'],
  { tags: ['matches', 'schools', 'rosters', 'teams', 'games', 'seasons'] }
);

interface ArchiveChampionRow {
  seasonId: string;
  division: string;
  schoolName: string;
  playerName: string | null;
}

export function pickChampionsBySeason(
  champions: ArchiveChampionRow[]
): Map<string, { champion: string; championSchool: string }> {
  const bySeason = new Map<string, { champion: string; championSchool: string }>();
  for (const division of ['Varsity', 'All', 'JV']) {
    for (const champ of champions) {
      if (champ.division === division && !bySeason.has(champ.seasonId)) {
        bySeason.set(champ.seasonId, {
          champion: champ.playerName ?? champ.schoolName,
          championSchool: champ.schoolName,
        });
      }
    }
  }
  return bySeason;
}

export async function getArchiveIndex() {
  const [seasons, counts, champions] = await Promise.all([
    getSeasonsWithGames(),
    db
      .select({ seasonId: schema.matches.seasonId, matchCount: count() })
      .from(schema.matches)
      .groupBy(schema.matches.seasonId),
    db
      .select({
        seasonId: schema.seasonStandings.seasonId,
        division: schema.seasonStandings.division,
        schoolName: schema.schools.name,
        playerName: schema.seasonStandings.playerName,
      })
      .from(schema.seasonStandings)
      .innerJoin(schema.schools, eq(schema.seasonStandings.schoolId, schema.schools.id))
      .where(eq(schema.seasonStandings.rank, 1)),
  ]);

  const countBySeason = new Map(counts.map((c) => [c.seasonId, c.matchCount]));
  const championBySeason = pickChampionsBySeason(champions);

  return seasons.map((s) => {
    const c = championBySeason.get(s.id);
    return {
      ...s,
      matchCount: countBySeason.get(s.id) ?? 0,
      champion: c?.champion ?? null,
      championSchool: c?.championSchool ?? null,
    };
  });
}

const RECENT_RESULTS_LIMIT = 3;

export function buildHubMatchQuery(opts: {
  seasonId: string;
  division: HubDivision;
  conditions: (SQL | undefined)[];
  direction: 'asc' | 'desc';
  limit: number;
}) {
  const dir = opts.direction === 'desc' ? desc : asc;
  return db
    .select({
      id: schema.matches.id,
      scheduledAt: schema.matches.scheduledAt,
      status: schema.matches.status,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      homeTeam: homeSchool.name,
      awayTeam: awaySchool.name,
    })
    .from(schema.matches)
    .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
    .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
    .innerJoin(homeSchool, eq(homeTeam.schoolId, homeSchool.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
    .innerJoin(awaySchool, eq(awayTeam.schoolId, awaySchool.id))
    .where(
      and(
        eq(schema.matches.seasonId, opts.seasonId),
        or(
          eq(hubDivisionSql(homeRoster.division), opts.division),
          eq(hubDivisionSql(awayRoster.division), opts.division)
        ),
        isNull(homeSchool.deletedAt),
        isNull(awaySchool.deletedAt),
        ...opts.conditions
      )
    )
    .orderBy(dir(schema.matches.scheduledAt), dir(schema.matches.id))
    .limit(opts.limit);
}

export function buildFormGuideQuery(opts: {
  seasonId: string;
  division: HubDivision;
  schools: string[];
  perSchool: number;
}) {
  const side = (which: 'home' | 'away') => {
    const school = which === 'home' ? homeSchool : awaySchool;
    const roster = which === 'home' ? homeRoster : awayRoster;
    const scored = which === 'home' ? schema.matches.homeScore : schema.matches.awayScore;
    const conceded = which === 'home' ? schema.matches.awayScore : schema.matches.homeScore;
    return db
      .select({
        id: schema.matches.id,
        scheduledAt: schema.matches.scheduledAt,
        school: school.name,
        scored: sql<number>`${scored}`.as('scored'),
        conceded: sql<number>`${conceded}`.as('conceded'),
      })
      .from(schema.matches)
      .innerJoin(homeRoster, eq(schema.matches.homeRosterId, homeRoster.id))
      .innerJoin(homeTeam, eq(homeRoster.teamId, homeTeam.id))
      .innerJoin(homeSchool, eq(homeTeam.schoolId, homeSchool.id))
      .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
      .innerJoin(awayTeam, eq(awayRoster.teamId, awayTeam.id))
      .innerJoin(awaySchool, eq(awayTeam.schoolId, awaySchool.id))
      .where(
        and(
          eq(schema.matches.seasonId, opts.seasonId),
          eq(canonicalDivisionSql(roster.division), opts.division),
          inArray(school.name, opts.schools),
          inArray(schema.matches.status, ['completed', 'forfeit']),
          isNotNull(schema.matches.homeScore),
          isNotNull(schema.matches.awayScore),
          isNull(homeSchool.deletedAt),
          isNull(awaySchool.deletedAt)
        )
      );
  };

  const sides = unionAll(side('home'), side('away')).as('form_sides');
  const ranked = db
    .select({
      id: sides.id,
      scheduledAt: sides.scheduledAt,
      school: sides.school,
      scored: sides.scored,
      conceded: sides.conceded,
      recency:
        sql<number>`row_number() over (partition by ${sides.school} order by ${sides.scheduledAt} desc, ${sides.id} desc)`.as(
          'recency'
        ),
    })
    .from(sides)
    .as('ranked_sides');

  return db
    .select({
      id: ranked.id,
      scheduledAt: ranked.scheduledAt,
      school: ranked.school,
      scored: ranked.scored,
      conceded: ranked.conceded,
    })
    .from(ranked)
    .where(lte(ranked.recency, opts.perSchool));
}

export interface GameHubData {
  nextMatch: { date: string; teams: string } | null;
  recentResults: {
    date: string;
    teams: string;
    outcome: FormOutcome;
    result: string;
    forfeit: boolean;
  }[];
  topTeams: {
    rank: number;
    team: string;
    teamLabel: string;
    division: CanonicalDivision;
    wins: number;
    losses: number;
    winPct: number;
    form: FormOutcome[];
  }[];
  seasonName: string | null;
  standingsFormat: StandingsFormat;
  standingsReconstructed: boolean;
  division: HubDivision;
}

export async function getGameHubData(
  gameSlug: string,
  division: HubDivision
): Promise<GameHubData> {
  let nextMatch: GameHubData['nextMatch'] = null;
  let recentResults: GameHubData['recentResults'] = [];
  let topTeams: GameHubData['topTeams'] = [];
  let seasonName: string | null = null;
  let standingsFormat: StandingsFormat = 'divided';
  let standingsReconstructed = false;

  const gameRow = await db
    .select()
    .from(schema.games)
    .where(
      or(
        eq(schema.games.slug, gameSlug),
        eq(schema.games.slug, dbGameSlug(gameSlug))
      )
    )
    .limit(1);

  if (gameRow[0]) {
    const gameId = gameRow[0].id;

    const activeSeason = await getActiveSeasonForGame(gameId);

    if (activeSeason) {
      seasonName = activeSeason.name;

      const [scheduledRows, completedRows, summary] = await Promise.all([
        buildHubMatchQuery({
          seasonId: activeSeason.id,
          division,
          conditions: [
            eq(schema.matches.status, 'scheduled'),
            gte(schema.matches.scheduledAt, new Date()),
          ],
          direction: 'asc',
          limit: 1,
        }),
        buildHubMatchQuery({
          seasonId: activeSeason.id,
          division,
          conditions: [
            inArray(schema.matches.status, ['completed', 'forfeit']),
            isNotNull(schema.matches.homeScore),
            isNotNull(schema.matches.awayScore),
          ],
          direction: 'desc',
          limit: RECENT_RESULTS_LIMIT,
        }),
        getGameSeasonSummary(activeSeason.id),
      ]);

      standingsFormat = summary.standingsFormat;
      standingsReconstructed = summary.standingsReconstructed;
      const shownTeams = summary.topTeamsByDivision[division];

      const formRows =
        summary.standingsSource[division] === 'snapshot' ||
        summary.standingsFormat === 'combined' ||
        shownTeams.length === 0
          ? []
          : await buildFormGuideQuery({
              seasonId: activeSeason.id,
              division,
              schools: shownTeams.map((entry) => entry.team),
              perSchool: FORM_LENGTH,
            });
      const formGuides = buildFormGuide(formRows, FORM_LENGTH);

      topTeams = shownTeams.map((entry) => ({
        ...entry,
        form: formGuides.get(entry.team) ?? [],
      }));

      if (scheduledRows[0]) {
        nextMatch = {
          date: scheduledRows[0].scheduledAt.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          teams: `${scheduledRows[0].homeTeam} vs. ${scheduledRows[0].awayTeam}`,
        };
      }

      recentResults = completedRows.map((r) => {
        const home = r.homeScore ?? 0;
        const away = r.awayScore ?? 0;
        const outcome: FormOutcome = home > away ? 'W' : home < away ? 'L' : 'D';
        return {
          date: r.scheduledAt.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          teams: `${r.homeTeam} vs. ${r.awayTeam}`,
          outcome,
          result: `${outcome} ${home}-${away}`,
          forfeit: r.status === 'forfeit',
        };
      });
    }
  }

  return {
    nextMatch,
    recentResults,
    topTeams,
    seasonName,
    standingsFormat,
    standingsReconstructed,
    division,
  };
}
