import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, lte, notExists, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { alias, unionAll } from 'drizzle-orm/pg-core';
import {
  canonicalDivision,
  clampPageLimit,
  isDerivedStandings,
  normalizeSort,
  rankComputedStandings,
  seasonDivisionList,
  standingsTeamLabel,
  toHubDivision,
  type CanonicalDivision,
  type HubDivision,
  type MatchesPage,
  type MatchesPageParams,
  type SeasonStandingsResult,
  type StandingsFormat,
} from './match-page';
import { FORM_LENGTH, buildFormGuide, type FormOutcome } from '@/app/lib/game-hub-form';

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
 * `canonicalDivision` as a SQL expression, so a division filter can be pushed
 * into the query instead of being applied to whatever rows came back.
 *
 * This must stay in step with the TypeScript version in `match-page.ts` — the
 * table of spellings it implements is documented there, and
 * `match-page.test.ts` pins it. Two implementations exist because both sides
 * need it: the match scan filters in SQL so it can `LIMIT`, while
 * `getGameSeasonSummary` buckets rows it already holds in memory.
 */
const canonicalDivisionSql = (column: SQLWrapper) =>
  sql<CanonicalDivision>`case when ${column} in ('JV', 'B') then 'JV' when ${column} = 'All' then 'All' else 'Varsity' end`;

/** The same expression, collapsed onto the hub's two tabs (`All` -> Varsity). */
const hubDivisionSql = (column: SQLWrapper) =>
  sql<HubDivision>`case when ${column} in ('JV', 'B') then 'JV' else 'Varsity' end`;

/**
 * Narrow the `seasons.standings_format` column to the union, defaulting to
 * `divided` for a season this database doesn't have and for any value the
 * column somehow holds that isn't one of the two. `divided` is the column's own
 * default and the behaviour every season had before the column existed, so an
 * unrecognised value changes nothing rather than silently merging two divisions
 * into one table.
 */
const toStandingsFormat = (value: string | null | undefined): StandingsFormat =>
  value === 'combined' ? 'combined' : 'divided';

/** One season's declared standings format. */
async function readStandingsFormat(seasonId: string): Promise<StandingsFormat> {
  const rows = await db
    .select({ standingsFormat: schema.seasons.standingsFormat })
    .from(schema.seasons)
    .where(eq(schema.seasons.id, seasonId))
    .limit(1);
  return toStandingsFormat(rows[0]?.standingsFormat);
}

/**
 * Divisions that actually exist for a season, ordered Varsity, JV, All.
 * Union of snapshot standings divisions and live roster divisions, since a
 * season may have either (TFT 2022-23 is only an "All" individual snapshot).
 *
 * Rows are canonicalized first: a season whose rosters were created in Admin
 * spells its divisions `A`/`B`, which matched none of `DIVISIONS` and left the
 * season claiming to have no divisions at all.
 *
 * A `combined` season reports exactly one division, the `Combined` pseudo-value,
 * even though its rows really do carry both `Varsity` and `JV`. Those labels name
 * the squad each school entered, not a bracket it was ranked in, so offering
 * them as a switch would put two tabs on screen that each promise a standings
 * table this competition never produced.
 */
export async function getSeasonDivisions(seasonId: string): Promise<string[]> {
  const [snapshotRows, rosterRows, format] = await Promise.all([
    db
      .selectDistinct({ division: schema.seasonStandings.division })
      .from(schema.seasonStandings)
      .where(eq(schema.seasonStandings.seasonId, seasonId)),
    db
      .selectDistinct({ division: schema.rosters.division })
      .from(schema.rosters)
      .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
      .where(eq(schema.teams.seasonId, seasonId)),
    // Folded into the same round trip rather than awaited first: the division
    // lists are needed either way, and the format only decides whether they get
    // collapsed.
    readStandingsFormat(seasonId),
  ]);
  return seasonDivisionList(
    format,
    [...snapshotRows, ...rosterRows].map((r) => r.division)
  );
}

/**
 * The two halves of `getSeasonStandingsFor`'s read, as compilable queries.
 *
 * They exist as functions only so the division predicate can be asserted
 * without a database: whether that one line is present is the whole difference
 * between a combined season's single table and every other season's two, and it
 * is the riskiest line the format flag added. Both are exported for
 * `queries-hub.test.ts`, which compiles them with `toSQL()` rather than needing
 * a live database.
 */
export function buildSeasonStandingsSnapshotQuery(opts: {
  seasonId: string;
  /** Canonical division to select. Ignored when `combined`. */
  division: CanonicalDivision;
  combined: boolean;
}) {
  return db
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
        eq(schema.seasonStandings.seasonId, opts.seasonId),
        // Dropped for a combined season: there is one table, and the ranks
        // stored on these rows were measured against the whole field.
        ...(opts.combined
          ? []
          : [eq(canonicalDivisionSql(schema.seasonStandings.division), opts.division)])
      )
    )
    .orderBy(sql`${schema.seasonStandings.rank} asc nulls last`, asc(schema.schools.name));
}

/** @see buildSeasonStandingsSnapshotQuery */
export function buildSeasonStandingsComputedQuery(opts: {
  seasonId: string;
  division: CanonicalDivision;
  combined: boolean;
}) {
  return db
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
        eq(schema.teams.seasonId, opts.seasonId),
        // As above: a combined season ranks every roster in the season
        // together, so there is nothing to filter on.
        ...(opts.combined
          ? []
          : [eq(canonicalDivisionSql(schema.rosterStandings.division), opts.division)]),
        isNull(schema.schools.deletedAt)
      )
    );
}

/**
 * Standings for a season+division: archived seasons are served from the
 * season_standings snapshot table (imported from spreadsheets, since most
 * archived seasons lack per-match scores); seasons without a snapshot fall
 * back to the live roster_standings view computed from match results.
 *
 * Both sides compare *canonical* divisions, not raw column values. The stored
 * spelling depends on who wrote the row — the archive importer writes
 * `Varsity`/`JV`, Admin -> Roster writes `A`/`B` — so an exact match dropped
 * every admin-managed season's standings on both the requested-division path
 * and the computed fallback, which is what made the hub's standings tile
 * unfillable on either tab. `division` is canonicalized once here, so callers
 * may pass whichever spelling they hold.
 *
 * For a `combined` season the requested division is ignored entirely and the
 * whole field comes back as one ranked table. Filtering it would slice a single
 * round-robin into two tables whose records were earned mostly against teams in
 * the *other* one — which is exactly the bug this format flag exists to end.
 * Callers still pass a division because the routes still have one (see
 * `GameHubView`); it just has nothing left to select on.
 *
 * `standingsFormat` may be supplied by a caller that already read it, to save
 * the lookup; everything else is unchanged by passing it.
 */
export async function getSeasonStandingsFor(
  seasonId: string,
  division: string,
  standingsFormat?: StandingsFormat
): Promise<SeasonStandingsResult> {
  const format = standingsFormat ?? (await readStandingsFormat(seasonId));
  const combined = format === 'combined';
  const wanted = canonicalDivision(division);
  const snapshot = await buildSeasonStandingsSnapshotQuery({
    seasonId,
    division: wanted,
    combined,
  });

  // Same reasoning as the computed branch below: report the division the
  // caller asked for, not the spelling the importer happened to store.
  //
  // A combined season is the exception, and it is the one case where the row's
  // own division is the load-bearing value: it names the squad the school
  // entered, and it is all that distinguishes two rows of the same school from
  // each other. Overwriting it with `wanted` would leave Brooklyn Technical
  // listed twice, identically, at two different ranks.
  if (snapshot.length > 0) {
    return {
      source: 'snapshot',
      standingsFormat: format,
      rows: snapshot.map((r) => ({
        ...r,
        division: combined ? canonicalDivision(r.division) : wanted,
      })),
    };
  }

  const computed = await buildSeasonStandingsComputedQuery({
    seasonId,
    division: wanted,
    combined,
  });

  return {
    source: 'computed',
    standingsFormat: format,
    // Report the canonical division, not the raw column: the WHERE clause
    // above constrained the rows to `wanted`, and echoing `A` back from the
    // column would contradict the tab that asked for Varsity. A combined
    // season keeps the row's own division — canonicalized, so an admin-written
    // `A`/`B` still reads as the Varsity/JV squad it means — because there is no
    // tab to contradict and the squad is what tells two rows of one school
    // apart. `rankComputedStandings` tie-breaks on it too.
    rows: rankComputedStandings(
      computed.map((r) => ({ ...r, division: combined ? canonicalDivision(r.division) : wanted }))
    ),
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
      .select({
        id: schema.leadership.id,
        memberId: schema.leadership.memberId,
        name: schema.leadership.name,
        role: schema.leadership.role,
        year: schema.leadership.year,
        highSchool: schema.leadership.highSchool,
        university: schema.leadership.university,
        schoolName: schema.schools.name,
        graduationYear: schema.members.graduationYear,
      })
      .from(schema.leadership)
      .leftJoin(schema.members, eq(schema.leadership.memberId, schema.members.id))
      .leftJoin(schema.schools, eq(schema.members.schoolId, schema.schools.id))
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
 * Game landing page summary for one season: the top five teams of each
 * division, snapshot-aware via getSeasonStandingsFor, plus which of the two
 * sources produced each table. Individual (per-player) standings rows are
 * excluded from team summaries.
 *
 * A `combined` season has one table, and both hub routes get *that* table
 * rather than a half of it. The routes still exist — `/[game]` -> `/[game]/varsity`
 * is a static 308 in `next.config.ts` (PR #46) and a redirect conditional on one
 * season's format cannot live in static config — so the honest answer is to
 * serve the same combined standings on each and let the page stop claiming they
 * are one division's.
 */
export async function getGameSeasonSummary(seasonId: string) {
  // One snapshot query covers both divisions; only divisions without
  // snapshot rows pay for the computed fallback.
  //
  // It reads the season's snapshot rows *whole* and buckets them here. The
  // previous `division IN ('Varsity','JV')` filter looked like a narrowing but
  // was a silent data loss: it dropped every row an admin had written as
  // `A`/`B`, so a season managed entirely through Admin had a snapshot the hub
  // could never read, and both of its division tabs fell back to a computed
  // table that the same mismatch had already emptied.
  const [snapshot, standingsFormat] = await Promise.all([
    db
      .select({
        schoolName: schema.schools.name,
        division: schema.seasonStandings.division,
        rank: schema.seasonStandings.rank,
        wins: schema.seasonStandings.wins,
        losses: schema.seasonStandings.losses,
        winPct: schema.seasonStandings.winPct,
        playerName: schema.seasonStandings.playerName,
        // Read so the hub can caption a reconstructed table the same way
        // /[game]/standings does, from the same marker.
        notes: schema.seasonStandings.notes,
      })
      .from(schema.seasonStandings)
      .innerJoin(schema.schools, eq(schema.seasonStandings.schoolId, schema.schools.id))
      .where(eq(schema.seasonStandings.seasonId, seasonId))
      .orderBy(sql`${schema.seasonStandings.rank} asc nulls last`, asc(schema.schools.name)),
    readStandingsFormat(seasonId),
  ]);
  const combined = standingsFormat === 'combined';

  // One predicate for both the rows and the reported source, so the two can
  // never drift into disagreeing about which path a division came from.
  //
  // It buckets by `toHubDivision`, the same reading the rest of the hub uses:
  // this column holds `Varsity`/`JV` from the importer, `A`/`B` from Admin and
  // `All` from per-player games, so comparing the raw value would report
  // "computed" for a division whose snapshot it had merely failed to recognise
  // — and then show form chips beside an imported record.
  //
  // For a combined season the question stops being per-division: there is one
  // table, so either the season has a snapshot of it or it doesn't.
  const hasSnapshot = (division: HubDivision) =>
    combined ? snapshot.length > 0 : snapshot.some((r) => toHubDivision(r.division) === division);
  const divisionRows = async (division: HubDivision) => {
    if (hasSnapshot(division)) {
      return combined ? snapshot : snapshot.filter((r) => toHubDivision(r.division) === division);
    }
    // `standingsFormat` is passed along: it is already in hand, and re-reading
    // it per division would be two extra round trips for one answer. It is also
    // what makes the `division` argument a no-op for a combined season — the
    // call comes back with the whole field either way.
    return (await getSeasonStandingsFor(seasonId, division, standingsFormat)).rows;
  };
  // A combined season resolves its one table once and hands the same rows to
  // both routes; without this the identical query would run twice.
  const combinedRows = combined ? await divisionRows('Varsity') : [];
  const [varsityRows, jvRows] = combined
    ? [combinedRows, combinedRows]
    : await Promise.all([divisionRows('Varsity'), divisionRows('JV')]);
  const varsityTeams = varsityRows.filter((r) => r.playerName === null);
  const jvTeams = jvRows.filter((r) => r.playerName === null);
  /**
   * `team` is the raw school name and stays raw, because it is a *key*, not a
   * label: `buildFormGuideQuery` matches it against `schools.name` in SQL and
   * `buildFormGuide` keys its result map by the same string. Baking the squad
   * suffix into it would make that lookup match nothing and silently drop every
   * school's form chips. `teamLabel` is the string to print.
   */
  const topFive = (rows: typeof varsityTeams) =>
    rows.slice(0, 5).map((r, i) => ({
      rank: r.rank ?? i + 1,
      team: r.schoolName,
      teamLabel: standingsTeamLabel(r, standingsFormat),
      /** The squad this row is, so a consumer can key two rows of one school apart. */
      division: canonicalDivision(r.division),
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      winPct: r.winPct ?? 0,
    }));

  return {
    /** Whether the tables below are one competition or one division each. */
    standingsFormat,
    /**
     * Whether the table was tallied here from match rows rather than imported
     * from an official sheet. Both routes of a combined season read the same
     * table, so this is one answer for the season, not one per division.
     */
    standingsReconstructed: isDerivedStandings(snapshot),
    // Both divisions are already in memory from the queries above, so serving
    // JV costs nothing extra — it was previously computed and discarded.
    topTeams: topFive(varsityTeams),
    /**
     * Where each division's table came from. A `snapshot` table was imported
     * whole from `season_standings`; its wins and losses are *not* a tally of
     * this database's match rows, so nothing that reads match rows may be shown
     * next to it as if it explained the record.
     */
    standingsSource: {
      Varsity: hasSnapshot('Varsity') ? ('snapshot' as const) : ('computed' as const),
      JV: hasSnapshot('JV') ? ('snapshot' as const) : ('computed' as const),
    },
    topTeamsByDivision: {
      Varsity: topFive(varsityTeams),
      JV: topFive(jvTeams),
    },
  };
}

/** How many completed matches the hub's results tiles show, newest first. */
const RECENT_RESULTS_LIMIT = 3;

/**
 * The hub's match scan, as one bounded query.
 *
 * Every part of the filter that used to run in memory now runs in SQL, which
 * is what lets the caller ask for exactly the rows it renders. The old scan
 * read 500 whole match rows per status and threw most of them away, and its
 * cap was a heuristic rather than a bound: it covered the season across *both*
 * divisions, so one division's next match could sit past the window purely
 * because the other division had more fixtures ahead of it.
 *
 * A match belongs to a division if *either* roster is in it, and each side is
 * judged by its own roster. Cross-division fixtures are real — 2023-24 LoL ran
 * Midwood Varsity against Midwood JV — and attributing the match to the home
 * roster alone made it invisible on the away side's tab, while
 * `roster_standings` had already counted the away school's win. The two now
 * agree.
 *
 * Both orderings carry `id` as a tiebreaker. Bulk-imported seasons default
 * every unknown kickoff to the same timestamp — the active Valorant season has
 * six matches sharing one — so without it, `LIMIT` would return a different
 * row between two identical requests.
 *
 * Exported for `queries-hub.test.ts`, which asserts the generated SQL rather
 * than needing a live database.
 */
export function buildHubMatchQuery(opts: {
  seasonId: string;
  division: HubDivision;
  /** Status, score and time constraints layered on top of the division filter. */
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
        // A soft-deleted school is not nameable on a public page, and the tile
        // has no honest way to render a match it cannot name. The previous
        // implementation dropped these rows too, as a side effect of building
        // its lookup map from non-deleted schools only.
        isNull(homeSchool.deletedAt),
        isNull(awaySchool.deletedAt),
        ...opts.conditions
      )
    )
    .orderBy(dir(schema.matches.scheduledAt), dir(schema.matches.id))
    .limit(opts.limit);
}

/**
 * The standings tile's form guides, as one bounded query.
 *
 * A form guide is per *school*, not per match, which is why this cannot reuse
 * `buildHubMatchQuery`: "the last five matches in the division" is not "the
 * last five matches for each of these five schools", and a plain `LIMIT` over
 * the season's matches can satisfy neither. The guides used to piggyback on a
 * 500-row in-memory scan of the whole season; that scan is gone, and reviving
 * it to feed a decoration on five table rows would be the worst read on the
 * page.
 *
 * So the bound is expressed where it is actually true — per school. The match
 * is split into its two sides, each side keyed by the school that played it and
 * carrying that side's own score, and `row_number()` partitioned by school
 * takes the newest `perSchool` of each. The result is at most
 * `schools.length * perSchool` rows (25 as the hub calls it) no matter how long
 * the season is, in one round trip rather than one query per school.
 *
 * Splitting by side is also what makes the division reading correct: a side
 * counts only if *its own* roster is in the division on screen. A Varsity-home
 * vs JV-away fixture is one row on the Varsity tab (the home side) and a
 * different row on the JV tab (the away side) — the same attribution
 * `buildHubMatchQuery` and `roster_standings` use, so the chips and the W-L
 * column beside them are counting the same games.
 *
 * The partition orders by `scheduled_at desc, id desc`, the tiebreaker
 * `buildHubMatchQuery` carries for the same reason: bulk-imported seasons give
 * every unknown kickoff one timestamp, and without it a school's five chips
 * could come back in a different order — or be a different five — between two
 * identical requests.
 *
 * Exported for `queries-hub.test.ts`, which asserts the generated SQL rather
 * than needing a live database.
 */
export function buildFormGuideQuery(opts: {
  seasonId: string;
  division: HubDivision;
  /** School names as the standings tile prints them; the only key both sides share. */
  schools: string[];
  perSchool: number;
}) {
  /**
   * One side of every decided match the given schools played in this division.
   *
   * `scored`/`conceded` are that side's own scores, so the caller reads an
   * outcome without needing to know which end of the fixture it is looking at.
   * What counts as a win, a loss or a draw stays in `game-hub-form.ts`, where
   * it is unit-testable; SQL's job here is only to bound and to rank.
   */
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
          // `canonicalDivision`, not `hubDivision` — the one place on this page
          // where the two must differ.
          //
          // The tiles use the hub reading, which folds `All` onto Varsity so a
          // per-player game's matches land on the tab a bare game URL opens.
          // The strip is not listing matches, though; it is explaining the W-L
          // printed beside it, and that number comes from
          // `getSeasonStandingsFor`, whose computed branch selects rosters by
          // `canonicalDivision` and so leaves `All` rosters out of both tables.
          // Folding `All` in here would put chips on a Varsity row for games
          // its record never counted. Matching the standings' own predicate is
          // what keeps the two countable against each other.
          eq(canonicalDivisionSql(roster.division), opts.division),
          inArray(school.name, opts.schools),
          // Forfeits count in `roster_standings`, so they count here — the
          // chips have to be countable against the W-L printed beside them.
          inArray(schema.matches.status, ['completed', 'forfeit']),
          isNotNull(schema.matches.homeScore),
          isNotNull(schema.matches.awayScore),
          // A match involving a soft-deleted school is not rendered anywhere
          // else on this page, and a chip for a game the tiles refuse to name
          // would be a result the reader has no way to look up. Both sides are
          // tested, not just this one: the row is excluded, not re-attributed.
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
  /**
   * Match tiles carry no division of their own. They are already scoped to
   * `division` below, and a cross-division match has two answers — one per
   * roster — so the only label that is true on the tab you are reading is the
   * tab's own division. The page renders that; nothing here can disagree with
   * it.
   */
  nextMatch: { date: string; teams: string } | null;
  recentResults: {
    date: string;
    teams: string;
    /**
     * The home side's verdict, as its own value rather than something the page
     * has to recover from the first character of `result`. The same three
     * letters the form chips use, so one match cannot read two ways.
     */
    outcome: FormOutcome;
    result: string;
    /** A forfeit is a real result, but the rest of the site says so on its face. */
    forfeit: boolean;
  }[];
  /**
   * Top five schools in `division`. `form` is that school's last five decided
   * matches, oldest first. It is empty whenever the division's standings were
   * imported from the `season_standings` snapshot rather than tallied from
   * match rows — an imported record is not something this database's matches
   * can explain — and shorter than five when a school has played fewer. It is
   * never padded.
   */
  topTeams: {
    rank: number;
    /**
     * The raw school name. It is the key the form guide was looked up by, so it
     * must stay exactly what `schools.name` holds — print `teamLabel` instead.
     */
    team: string;
    /**
     * What to render. Identical to `team` for a divided season; for a combined
     * one it carries the squad ("Brooklyn Technical High School — JV"), which is
     * the only thing distinguishing two rows of the same school.
     */
    teamLabel: string;
    /** The squad, so two rows of one school have distinct React keys. */
    division: CanonicalDivision;
    wins: number;
    losses: number;
    winPct: number;
    form: FormOutcome[];
  }[];
  /** Name of the active season, for the hub's season-context meta pill. */
  seasonName: string | null;
  /**
   * Whether the season ran one table or one per division. `combined` means both
   * hub routes are showing the *same* standings, and the page has to say so
   * rather than titling them as this division's.
   */
  standingsFormat: StandingsFormat;
  /** Whether that table was tallied from match rows instead of imported. */
  standingsReconstructed: boolean;
  /** The division every other field on this object describes. */
  division: HubDivision;
}

/**
 * Everything the game hub landing page (`/[game]/varsity`, `/[game]/junior-varsity`)
 * needs for its active season, scoped to one division: aggregate records, the
 * next scheduled match, the latest results, and the top five teams.
 *
 * `division` comes from the route segment, so it is one of two known values
 * rather than user input — the page can no longer be handed a division that
 * does not exist. Both divisions are always offered; a division with nothing
 * in it renders its empty state, which for a per-player game (TFT, osu!,
 * Tetris) is what JV honestly is.
 *
 * Uncached, like its season-summary neighbors: schedule edits must be fresh.
 */
export async function getGameHubData(
  gameSlug: string,
  division: HubDivision
): Promise<GameHubData> {
  // Empty-state defaults — no fabricated data
  let nextMatch: GameHubData['nextMatch'] = null;
  let recentResults: GameHubData['recentResults'] = [];
  let topTeams: GameHubData['topTeams'] = [];
  let seasonName: string | null = null;
  // Defaults to the column's default: with no season resolved (or a failed
  // query) there is no combined table to announce, so the page says nothing.
  let standingsFormat: StandingsFormat = 'divided';
  let standingsReconstructed = false;

  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, gameSlug))
      .limit(1);

    if (gameRow[0]) {
      const gameId = gameRow[0].id;

      const activeSeason = await db
        .select()
        .from(schema.seasons)
        .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.isActive, true)))
        .limit(1);

      if (activeSeason[0]) {
        // Already in memory from the query above — no extra DB work.
        seasonName = activeSeason[0].name;

        // Fetch the next match, recent results, and season summary in
        // parallel — they only depend on the active season. Each match query
        // is bounded to the rows its tile renders; both are filtered by
        // division in SQL, so the bound is a real one.
        const [scheduledRows, completedRows, summary] = await Promise.all([
          buildHubMatchQuery({
            seasonId: activeSeason[0].id,
            division,
            conditions: [
              eq(schema.matches.status, 'scheduled'),
              // A fixture is only "next" if it hasn't happened. Without this,
              // a season whose schedule was never marked complete puts a
              // months-old date in the page's largest, most prominent tile.
              gte(schema.matches.scheduledAt, new Date()),
            ],
            direction: 'asc',
            limit: 1,
          }),
          buildHubMatchQuery({
            seasonId: activeSeason[0].id,
            division,
            conditions: [
              // Forfeits are decided results: `roster_standings` counts them
              // in every W-L this page prints, and admin refuses to save one
              // without both scores. Reading only 'completed' here would show
              // a school 3-1 beside a three-chip strip whose newest chip is
              // the win *before* the forfeit. `getCachedRecentResults` has
              // always taken both statuses; the hub was the odd one out.
              inArray(schema.matches.status, ['completed', 'forfeit']),
              // Unrecorded results (null scores) would otherwise render "L 0-0".
              isNotNull(schema.matches.homeScore),
              isNotNull(schema.matches.awayScore),
            ],
            direction: 'desc',
            limit: RECENT_RESULTS_LIMIT,
          }),
          getGameSeasonSummary(activeSeason[0].id),
        ]);

        standingsFormat = summary.standingsFormat;
        standingsReconstructed = summary.standingsReconstructed;
        const shownTeams = summary.topTeamsByDivision[division];
        /**
         * Snapshot standings get no form at all, even when the season happens to
         * carry some scored match rows. An imported table's 12-2 was never a
         * tally of the rows in this database — the import brings whole standings
         * and only the matches it has sheets for — so chips built from those
         * rows would sit beside a record they do not explain: two real losses
         * rendered as "lost its last two" next to 12-2. Reporting nothing is the
         * only honest answer, and the same one an archived season with no match
         * rows at all already gives.
         *
         * A combined season gets none either, for a different reason: its table
         * lists a school once per squad, and the form guide is keyed by school
         * name alone — `buildFormGuideQuery` matches `schools.name` and
         * `buildFormGuide` maps by the same string. There is no key that tells
         * Brooklyn Technical's two squads apart, so one strip would be attached
         * to both rows and at least one of them would be someone else's results.
         *
         * The query runs after the summary because it needs the names the tile
         * is about to print, and it is skipped outright when there are none —
         * `inArray` on an empty list is a query with no answer to give.
         */
        const formRows =
          summary.standingsSource[division] === 'snapshot' ||
          summary.standingsFormat === 'combined' ||
          shownTeams.length === 0
            ? []
            : await buildFormGuideQuery({
                seasonId: activeSeason[0].id,
                division,
                // The raw school name, never `teamLabel`: this list is matched
                // against `schools.name` in SQL and read back out of a map keyed
                // by the same string, so a squad-suffixed name here would match
                // nothing and drop every chip with no error to show for it.
                schools: shownTeams.map((entry) => entry.team),
                perSchool: FORM_LENGTH,
              });
        const formGuides = buildFormGuide(formRows, FORM_LENGTH);
        // A school with no matches in this division gets no chips at all.
        topTeams = shownTeams.map((entry) => ({
          ...entry,
          // Keyed by the raw name for the same reason the query was.
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
          // The verdict is stated from the home side, as it always has been:
          // this is the league's results feed, not one school's, and the same
          // row appears on both divisions' tabs when the fixture crossed them.
          //
          // Drawn matches are listed rather than hidden, which is what the
          // homepage feed has always done. The hub used to exclude equal
          // scores, so a 1-1 was a match the site reported in one place and
          // denied in another — and a 0-0 forfeit, which the league does
          // produce, was the case that exclusion was really there to catch: it
          // rendered as "L 0-0" beside standings that counted it as neither a
          // win nor a loss. Naming it a draw says the true thing instead of
          // saying nothing.
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
  } catch (error) {
    console.error(`Failed to load dynamic data for ${gameSlug}`, error);
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
