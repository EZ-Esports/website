import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, lte, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  DIVISIONS,
  clampPageLimit,
  normalizeSort,
  rankComputedStandings,
  type MatchesPage,
  type MatchesPageParams,
  type SeasonStandingsResult,
} from './match-page';

/** Default page size for public-facing paginated lists. */
export const DEFAULT_PAGE_SIZE = 20;

export const getCachedGames = unstable_cache(
  async () => {
    return db.select().from(schema.games);
  },
  ['games-list'],
  { tags: ['games'] }
);

export const getCachedSchools = unstable_cache(
  async () => {
    return db
      .select()
      .from(schema.schools)
      .where(and(eq(schema.schools.isActive, true), isNull(schema.schools.deletedAt)))
      .orderBy(asc(schema.schools.displayOrder), asc(schema.schools.name));
  },
  ['schools-list'],
  { tags: ['schools'] }
);

export const getCachedMembers = unstable_cache(
  async () => {
    return db.select().from(schema.members);
  },
  ['members-list'],
  { tags: ['members'] }
);

export const getCachedTeams = unstable_cache(
  async () => {
    return db
      .select({
        id: schema.teams.id,
        schoolId: schema.teams.schoolId,
        gameId: schema.teams.gameId,
        seasonId: schema.teams.seasonId,
        createdAt: schema.teams.createdAt,
        updatedAt: schema.teams.updatedAt,
        name: schema.schools.name,
      })
      .from(schema.teams)
      .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
      .where(isNull(schema.schools.deletedAt));
  },
  ['teams-list'],
  { tags: ['teams'] }
);

export const getCachedSeasons = unstable_cache(
  async () => {
    return db.select().from(schema.seasons).where(eq(schema.seasons.isActive, true));
  },
  ['seasons-active'],
  { tags: ['seasons'] }
);

/** Uncached: all seasons (including inactive) for staff labels/lookups. */
export const getStaffSeasons = () => db.select().from(schema.seasons);

/**
 * Paginated match query for public-facing pages.
 * Use getStaffMatches() in staff views where you need all rows.
 */
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

// --- SEASON BROWSING & PAGINATED MATCHES ---

/** Seasons joined with their game, newest season first within each game. */
export const getSeasonsWithGames = unstable_cache(
  async () =>
    db
      .select({
        id: schema.seasons.id,
        name: schema.seasons.name,
        isActive: schema.seasons.isActive,
        gameId: schema.games.id,
        gameSlug: schema.games.slug,
        gameName: schema.games.displayName,
      })
      .from(schema.seasons)
      .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
      .orderBy(asc(schema.games.slug), desc(schema.seasons.name)),
  ['seasons-with-games'],
  { tags: ['seasons', 'games'] }
);

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
export async function getMatchesPage(params: MatchesPageParams): Promise<MatchesPage> {
  const sort = normalizeSort(params.sort);
  const limit = clampPageLimit(params.limit, DEFAULT_PAGE_SIZE);

  const conditions = [];
  if (params.seasonId) conditions.push(eq(schema.matches.seasonId, params.seasonId));
  if (params.gameId) conditions.push(eq(schema.seasons.gameId, params.gameId));
  if (params.division) conditions.push(eq(homeRoster.division, params.division));
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
  const rows = await db
    .select({
      id: schema.matches.id,
      seasonId: schema.matches.seasonId,
      scheduledAt: schema.matches.scheduledAt,
      status: schema.matches.status,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      division: homeRoster.division,
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

/**
 * All matches of a season (optionally one division) with names joined in,
 * oldest first. Used by the calendar view, which needs the whole season.
 */
export async function getSeasonMatches(seasonId: string, division?: string) {
  const conditions = [eq(schema.matches.seasonId, seasonId)];
  if (division) conditions.push(eq(homeRoster.division, division));
  return db
    .select({
      id: schema.matches.id,
      seasonId: schema.matches.seasonId,
      scheduledAt: schema.matches.scheduledAt,
      status: schema.matches.status,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      division: homeRoster.division,
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
 * Divisions that actually exist for a season, ordered Varsity, JV, All.
 * Union of snapshot standings divisions and live roster divisions, since a
 * season may have either (TFT 2022-23 is only an "All" individual snapshot).
 */
export async function getSeasonDivisions(seasonId: string): Promise<string[]> {
  const [snapshotRows, rosterRows] = await Promise.all([
    db
      .selectDistinct({ division: schema.seasonStandings.division })
      .from(schema.seasonStandings)
      .where(eq(schema.seasonStandings.seasonId, seasonId)),
    db
      .selectDistinct({ division: schema.rosters.division })
      .from(schema.rosters)
      .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
      .where(eq(schema.teams.seasonId, seasonId)),
  ]);
  const found = new Set([...snapshotRows, ...rosterRows].map((r) => r.division));
  const ordered = DIVISIONS.filter((d) => found.has(d));
  return ordered.length > 0 ? ordered : ['Varsity'];
}

/**
 * Standings for a season+division: archived seasons are served from the
 * season_standings snapshot table (imported from spreadsheets, since most
 * archived seasons lack per-match scores); seasons without a snapshot fall
 * back to the live roster_standings view computed from match results.
 */
export async function getSeasonStandingsFor(
  seasonId: string,
  division: string
): Promise<SeasonStandingsResult> {
  const snapshot = await db
    .select({
      schoolName: schema.schools.name,
      division: schema.seasonStandings.division,
      rank: schema.seasonStandings.rank,
      wins: schema.seasonStandings.wins,
      losses: schema.seasonStandings.losses,
      gamesPlayed: schema.seasonStandings.gamesPlayed,
      winPct: schema.seasonStandings.winPct,
      points: schema.seasonStandings.points,
      playerName: schema.seasonStandings.playerName,
      playerIgn: schema.seasonStandings.playerIgn,
      notes: schema.seasonStandings.notes,
    })
    .from(schema.seasonStandings)
    .innerJoin(schema.schools, eq(schema.seasonStandings.schoolId, schema.schools.id))
    .where(
      and(
        eq(schema.seasonStandings.seasonId, seasonId),
        eq(schema.seasonStandings.division, division)
      )
    )
    .orderBy(sql`${schema.seasonStandings.rank} asc nulls last`, asc(schema.schools.name));

  if (snapshot.length > 0) return { source: 'snapshot', rows: snapshot };

  const computed = await db
    .select({
      schoolName: schema.schools.name,
      division: schema.rosterStandings.division,
      wins: schema.rosterStandings.wins,
      losses: schema.rosterStandings.losses,
    })
    .from(schema.rosterStandings)
    .innerJoin(schema.teams, eq(schema.rosterStandings.teamId, schema.teams.id))
    .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
    .where(
      and(
        eq(schema.teams.seasonId, seasonId),
        eq(schema.rosterStandings.division, division),
        isNull(schema.schools.deletedAt)
      )
    );

  return {
    source: 'computed',
    // the view's columns are nullable in the type system; division is
    // constrained to the requested one by the WHERE clause above
    rows: rankComputedStandings(computed.map((r) => ({ ...r, division: r.division ?? division }))),
  };
}

export const getCachedRosters = unstable_cache(
  async () => {
    return db.select().from(schema.rosterStandings);
  },
  ['rosters-list'],
  { tags: ['rosters'] }
);

export const getCachedPlayers = unstable_cache(
  async () => {
    return db.select().from(schema.players);
  },
  ['players-list'],
  { tags: ['players'] }
);

/**
 * Paginated published news for public pages.
 * Use getStaffNews() in staff views where you need all statuses.
 */
export const getCachedNews = unstable_cache(
  async (limit = DEFAULT_PAGE_SIZE, offset = 0) => {
    return db
      .select()
      .from(schema.newsPosts)
      .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)))
      .orderBy(desc(schema.newsPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  },
  ['news-list'],
  { tags: ['news'] }
);

/** Uncached: returns all posts (all statuses) for staff views. */
export const getStaffNews = () =>
  db
    .select()
    .from(schema.newsPosts)
    .where(isNull(schema.newsPosts.deletedAt))
    .orderBy(desc(schema.newsPosts.updatedAt));

export const getCachedLeadership = unstable_cache(
  async () => {
    return db
      .select()
      .from(schema.leadership)
      .where(isNull(schema.leadership.deletedAt))
      .orderBy(desc(schema.leadership.year));
  },
  ['leadership-list'],
  { tags: ['leadership'] }
);

export const getCachedSponsors = unstable_cache(
  async () =>
    db
      .select()
      .from(schema.sponsors)
      .where(and(eq(schema.sponsors.isActive, true), isNull(schema.sponsors.deletedAt)))
      .orderBy(schema.sponsors.tier, schema.sponsors.displayOrder),
  ['sponsors'],
  { tags: ['sponsors'] }
);

export const getCachedPageContent = unstable_cache(
  async (key: string) => {
    const rows = await db
      .select()
      .from(schema.pageContent)
      .where(eq(schema.pageContent.key, key))
      .limit(1);
    return rows[0] ?? null;
  },
  ['page-content'],
  { tags: ['page-content'] }
);

export const getCachedHomepageContent = unstable_cache(
  async () => {
    const keys = ['hero.title', 'hero.subtitle', 'hero.cta', 'home_about_blurb'];
    const rows = await db
      .select({
        key: schema.pageContent.key,
        content: schema.pageContent.content,
      })
      .from(schema.pageContent)
      .where(inArray(schema.pageContent.key, keys));

    return Object.fromEntries(rows.map((row) => [row.key, row.content]));
  },
  ['homepage-content'],
  { tags: ['page-content'] }
);

export const getCachedHomepageGallery = unstable_cache(
  async () => {
    const rows = await db
      .select({
        id: schema.galleryImages.id,
        src: schema.galleryImages.src,
        caption: schema.galleryImages.caption,
      })
      .from(schema.galleryImages)
      .where(
        and(
          eq(schema.galleryImages.isActive, true),
          isNull(schema.galleryImages.deletedAt)
        )
      )
      .orderBy(
        asc(schema.galleryImages.displayOrder),
        asc(schema.galleryImages.createdAt)
      );

    // Defensive de-dupe: bad data entry has occasionally produced two active rows
    // for the same set pointing at the same underlying image file (by basename).
    // Silently drop the later duplicate so the homepage doesn't render the same
    // photo twice. Deliberately NOT keyed on display_order: it defaults to 0 in
    // both the schema and the admin upload form, so distinct images routinely
    // share a slot. The real fix is cleaning up the gallery_images table; this
    // just guards presentation.
    const seenSrc = new Set<string>();
    const dedupedRows = rows.filter((row) => {
      const basename = row.src.split('/').pop() ?? row.src;
      const srcKey = basename;
      if (seenSrc.has(srcKey)) return false;
      seenSrc.add(srcKey);
      return true;
    });

    return {
      set1: dedupedRows.map((row) => ({
        id: row.id,
        src: row.src,
        alt: row.caption || 'EZ Esports gallery photo',
      })),
    };
  },
  ['homepage-gallery'],
  { tags: ['gallery-images'] }
);

export const getSchoolApplications = async (status?: 'pending' | 'reviewed' | 'accepted') => {
  const conditions = status ? [eq(schema.schoolApplications.status, status)] : [];
  return db
    .select()
    .from(schema.schoolApplications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.schoolApplications.submittedAt));
};

export const getStaffApplications = async (status?: 'pending' | 'reviewed' | 'accepted') => {
  const conditions = status ? [eq(schema.staffApplications.status, status)] : [];
  return db
    .select()
    .from(schema.staffApplications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.staffApplications.submittedAt));
};

/** Count of all scheduled matches (for dashboard). */
export const countScheduledMatches = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.matches)
    .where(eq(schema.matches.status, 'scheduled'));
  return row?.value ?? 0;
};

/** Count of published (non-deleted) news posts (for dashboard). */
export const countPublishedNews = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.newsPosts)
    .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)));
  return row?.value ?? 0;
};

/**
 * Count of past scheduled matches still missing a final score (dashboard alert).
 * Pushes the filter into SQL instead of pulling every match into JS.
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

/**
 * Count of registered teams (on non-deleted schools) that have no roster yet
 * (dashboard alert). Uses a NOT EXISTS anti-join rather than computing the
 * full standings view just to test for roster presence.
 */
export const countTeamsWithoutRoster = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.teams)
    .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
    .where(
      and(
        isNull(schema.schools.deletedAt),
        notExists(
          db
            .select({ one: schema.rosters.id })
            .from(schema.rosters)
            .where(eq(schema.rosters.teamId, schema.teams.id))
        )
      )
    );
  return row?.value ?? 0;
};

/** Player headcount per roster (admin explorer tiles), one GROUP BY instead
 * of shipping every player row to the client. */
export async function getRosterPlayerCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ rosterId: schema.players.rosterId, value: count() })
    .from(schema.players)
    .groupBy(schema.players.rosterId);
  return Object.fromEntries(rows.map((r) => [r.rosterId, r.value]));
}

/** Latest matches with recorded results across all games (homepage pulse).
 * scheduledAt is serialized to an ISO string: unstable_cache JSON-serializes
 * its payload, so a Date would silently become a string on cache hits. */
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
    return rows.map((r) => ({ ...r, scheduledAt: r.scheduledAt.toISOString() }));
  },
  ['recent-results'],
  { tags: ['matches', 'schools', 'rosters', 'teams', 'games', 'seasons'] }
);

/**
 * Archive index: every season with its match count and champion (rank-1
 * snapshot row, preferring team standings over individual leaderboards).
 */
interface ArchiveChampionRow {
  seasonId: string;
  division: string;
  schoolName: string;
  playerName: string | null;
}

/**
 * Picks each season's rank-1 champion using division priority (Varsity > All > JV,
 * so a team champion wins over an individual leaderboard, which wins over JV).
 * Returns both the display `champion` (a player name for individual-format
 * divisions like TFT, otherwise the school name) and `championSchool`, which is
 * always the school name — callers that need to count distinct champion
 * *schools* shouldn't have to special-case individual-format divisions.
 */
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

/**
 * Game landing page summary for one season: top-5 varsity teams plus
 * aggregate Varsity/JV W-L records, snapshot-aware via getSeasonStandingsFor.
 * Individual (per-player) standings rows are excluded from team summaries.
 */
export async function getGameSeasonSummary(seasonId: string) {
  // One snapshot query covers both divisions; only divisions without
  // snapshot rows pay for the computed fallback.
  const snapshot = await db
    .select({
      schoolName: schema.schools.name,
      division: schema.seasonStandings.division,
      rank: schema.seasonStandings.rank,
      wins: schema.seasonStandings.wins,
      losses: schema.seasonStandings.losses,
      winPct: schema.seasonStandings.winPct,
      playerName: schema.seasonStandings.playerName,
    })
    .from(schema.seasonStandings)
    .innerJoin(schema.schools, eq(schema.seasonStandings.schoolId, schema.schools.id))
    .where(
      and(
        eq(schema.seasonStandings.seasonId, seasonId),
        inArray(schema.seasonStandings.division, ['Varsity', 'JV'])
      )
    )
    .orderBy(sql`${schema.seasonStandings.rank} asc nulls last`, asc(schema.schools.name));

  const divisionRows = async (division: 'Varsity' | 'JV') => {
    const rows = snapshot.filter((r) => r.division === division);
    if (rows.length > 0) return rows;
    return (await getSeasonStandingsFor(seasonId, division)).rows;
  };
  const [varsityRows, jvRows] = await Promise.all([divisionRows('Varsity'), divisionRows('JV')]);
  const varsityTeams = varsityRows.filter((r) => r.playerName === null);
  const jvTeams = jvRows.filter((r) => r.playerName === null);
  const totals = (rows: typeof varsityTeams) =>
    rows.reduce(
      (acc, r) => ({ wins: acc.wins + (r.wins ?? 0), losses: acc.losses + (r.losses ?? 0) }),
      { wins: 0, losses: 0 }
    );
  const v = totals(varsityTeams);
  const j = totals(jvTeams);
  return {
    topTeams: varsityTeams.slice(0, 5).map((r, i) => ({
      rank: r.rank ?? i + 1,
      team: r.schoolName,
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      winPct: r.winPct ?? 0,
    })),
    record: varsityTeams.length > 0 ? `${v.wins}-${v.losses}` : null,
    jvRecord: jvTeams.length > 0 ? `${j.wins}-${j.losses}` : null,
  };
}

export interface GameHubData {
  record: string | null;
  jvRecord: string | null;
  nextMatch: { date: string; teams: string; division: string } | null;
  recentResults: { date: string; teams: string; result: string; division: string }[];
  topTeams: { rank: number; team: string; wins: number; losses: number; winPct: number }[];
}

/**
 * Everything the game hub landing page (/[game]) needs for its active season:
 * aggregate records, the next scheduled match, the latest results, and the
 * top-5 varsity teams. Lifted verbatim from the former static hub pages.
 * Uncached, like its season-summary neighbors: schedule edits must be fresh.
 */
export async function getGameHubData(gameSlug: string): Promise<GameHubData> {
  // Empty-state defaults — no fabricated data
  let record: string | null = null;
  let jvRecord: string | null = null;
  let nextMatch: { date: string; teams: string; division: string } | null = null;
  let recentResults: { date: string; teams: string; result: string; division: string }[] = [];
  let topTeams: { rank: number; team: string; wins: number; losses: number; winPct: number }[] = [];

  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, gameSlug))
      .limit(1);

    if (gameRow[0]) {
      const gameId = gameRow[0].id;

      // Get team rows
      const teamRows = await db
        .select({
          id: schema.teams.id,
          schoolId: schema.teams.schoolId,
          gameId: schema.teams.gameId,
          seasonId: schema.teams.seasonId,
          name: schema.schools.name,
        })
        .from(schema.teams)
        .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
        .where(and(eq(schema.teams.gameId, gameId), isNull(schema.schools.deletedAt)));
      const teamMap = new Map(teamRows.map((t) => [t.id, t]));
      const teamIds = teamRows.map((t) => t.id);

      const rosterRows = teamIds.length > 0
        ? await db.select().from(schema.rosters).where(inArray(schema.rosters.teamId, teamIds))
        : [];
      const rosterMap = new Map(rosterRows.map((r) => [r.id, r]));

      // Next Match
      const activeSeason = await db
        .select()
        .from(schema.seasons)
        .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.isActive, true)))
        .limit(1);

      if (activeSeason[0]) {
        // Fetch the next match, recent results, and season summary in
        // parallel — they only depend on the active season.
        const [nextMatchRow, recentRows, summary] = await Promise.all([
          db
            .select()
            .from(schema.matches)
            .where(
              and(
                eq(schema.matches.seasonId, activeSeason[0].id),
                eq(schema.matches.status, 'scheduled')
              )
            )
            .orderBy(schema.matches.scheduledAt)
            .limit(1),
          db
            .select()
            .from(schema.matches)
            .where(
              and(
                eq(schema.matches.seasonId, activeSeason[0].id),
                eq(schema.matches.status, 'completed'),
                // Unrecorded results (null scores) would otherwise render "L 0-0".
                isNotNull(schema.matches.homeScore),
                isNotNull(schema.matches.awayScore)
              )
            )
            .orderBy(desc(schema.matches.scheduledAt))
            .limit(3),
          getGameSeasonSummary(activeSeason[0].id),
        ]);
        topTeams = summary.topTeams;
        record = summary.record;
        jvRecord = summary.jvRecord;

        if (nextMatchRow[0]) {
          const homeRoster = rosterMap.get(nextMatchRow[0].homeRosterId);
          const awayRoster = rosterMap.get(nextMatchRow[0].awayRosterId);
          const home = homeRoster ? teamMap.get(homeRoster.teamId) : null;
          const away = awayRoster ? teamMap.get(awayRoster.teamId) : null;
          nextMatch = {
            date: new Date(nextMatchRow[0].scheduledAt).toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            teams: `${home?.name || 'Home'} vs. ${away?.name || 'Away'}`,
            division: homeRoster?.division || 'Varsity',
          };
        }


        recentResults = recentRows.map((r) => {
          const homeRoster = rosterMap.get(r.homeRosterId);
          const awayRoster = rosterMap.get(r.awayRosterId);
          const home = homeRoster ? teamMap.get(homeRoster.teamId) : null;
          const away = awayRoster ? teamMap.get(awayRoster.teamId) : null;
          const homeWon = (r.homeScore ?? 0) > (r.awayScore ?? 0);
          return {
            date: new Date(r.scheduledAt).toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            teams: `${home?.name ?? 'Home'} vs. ${away?.name ?? 'Away'}`,
            result: `${homeWon ? 'W' : 'L'} ${r.homeScore ?? 0}-${r.awayScore ?? 0}`,
            division: homeRoster?.division || 'Varsity',
          };
        });
      }

    }
  } catch (error) {
    console.error(`Failed to load dynamic data for ${gameSlug}`, error);
  }

  return { record, jvRecord, nextMatch, recentResults, topTeams };
}

// --- STAFF ACCESS CONTROL ---

/** All provisioned staff members, oldest first. */
export const listStaffMembers = async () => {
  const users = await db
    .select({
      userId: schema.staffMembers.userId,
      email: schema.staffMembers.email,
      createdAt: schema.staffMembers.createdAt,
    })
    .from(schema.staffMembers)
    .orderBy(asc(schema.staffMembers.createdAt));

  if (users.length === 0) return [];

  const userRolesRows = await db
    .select({
      userId: schema.userRoles.userId,
      role: {
        id: schema.roles.id,
        name: schema.roles.name,
        color: schema.roles.color,
        isOwner: schema.roles.isOwner,
        position: schema.roles.position,
        permissions: schema.roles.permissions,
      },
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id));

  // Group by userId
  const rolesByUserId = new Map<string, typeof userRolesRows[0]['role'][]>();
  for (const row of userRolesRows) {
    if (!rolesByUserId.has(row.userId)) {
      rolesByUserId.set(row.userId, []);
    }
    rolesByUserId.get(row.userId)!.push(row.role);
  }

  return users.map((u) => {
    const roles = rolesByUserId.get(u.userId) || [];
    // Sort roles by position descending (highest first)
    roles.sort((a, b) => b.position - a.position);
    return {
      ...u,
      roles,
    };
  });
};

/** Outstanding (not yet accepted) staff invites, newest first, each tagged with
 * whether its link has already expired (computed here so the UI stays pure). */
export const listPendingStaffInvites = async () => {
  const rows = await db
    .select({
      id: schema.staffInvites.id,
      email: schema.staffInvites.email,
      expiresAt: schema.staffInvites.expiresAt,
      createdAt: schema.staffInvites.createdAt,
    })
    .from(schema.staffInvites)
    .where(isNull(schema.staffInvites.acceptedAt))
    .orderBy(desc(schema.staffInvites.createdAt));

  if (rows.length === 0) return [];

  const inviteRolesRows = await db
    .select({
      inviteId: schema.staffInviteRoles.inviteId,
      role: {
        id: schema.roles.id,
        name: schema.roles.name,
        color: schema.roles.color,
        position: schema.roles.position,
        isOwner: schema.roles.isOwner,
      },
    })
    .from(schema.staffInviteRoles)
    .innerJoin(schema.roles, eq(schema.staffInviteRoles.roleId, schema.roles.id));

  // Group by inviteId
  const rolesByInviteId = new Map<string, typeof inviteRolesRows[0]['role'][]>();
  for (const row of inviteRolesRows) {
    if (!rolesByInviteId.has(row.inviteId)) {
      rolesByInviteId.set(row.inviteId, []);
    }
    rolesByInviteId.get(row.inviteId)!.push(row.role);
  }

  const now = Date.now();
  return rows.map((row) => {
    const roles = rolesByInviteId.get(row.id) || [];
    // Sort roles by position descending (highest first)
    roles.sort((a, b) => b.position - a.position);
    return {
      ...row,
      roles,
      expired: row.expiresAt.getTime() < now,
    };
  });
};
