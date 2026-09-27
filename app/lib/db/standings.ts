import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, eq, inArray, isNull, sql, type SQLWrapper } from 'drizzle-orm';
import {
  canonicalDivision,
  isDerivedStandings,
  rankComputedStandings,
  seasonDivisionList,
  standingsTeamLabel,
  toHubDivision,
  toStandingsFormat,
  type CanonicalDivision,
  type HubDivision,
  type SeasonStandingsResult,
  type StandingsFormat,
} from './match-page';

/**
 * `canonicalDivision` as a SQL expression, so a division filter can be pushed
 * into the query instead of being applied to whatever rows came back.
 */
export const canonicalDivisionSql = (column: SQLWrapper) =>
  sql<CanonicalDivision>`case when ${column} in ('JV', 'B') then 'JV' when ${column} = 'All' then 'All' else 'Varsity' end`;

/** The same expression, collapsed onto the hub's two tabs (`All` -> Varsity). */
export const hubDivisionSql = (column: SQLWrapper) =>
  sql<HubDivision>`case when ${column} in ('JV', 'B') then 'JV' else 'Varsity' end`;

/** One season's declared standings format. */
export async function readStandingsFormat(seasonId: string): Promise<StandingsFormat> {
  const rows = await db
    .select({ standingsFormat: schema.seasons.standingsFormat })
    .from(schema.seasons)
    .where(eq(schema.seasons.id, seasonId))
    .limit(1);
  return toStandingsFormat(rows[0]?.standingsFormat);
}

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
 */
export function buildSeasonStandingsSnapshotQuery(opts: {
  seasonId: string;
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
        ...(opts.combined
          ? []
          : [eq(canonicalDivisionSql(schema.rosterStandings.division), opts.division)]),
        isNull(schema.schools.deletedAt)
      )
    );
}

/**
 * Standings for a season+division: archived seasons are served from the
 * season_standings snapshot table; seasons without a snapshot fall
 * back to the live roster_standings view computed from match results.
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
    rows: rankComputedStandings(
      computed.map((r) => ({ ...r, division: combined ? canonicalDivision(r.division) : wanted }))
    ),
  };
}

/**
 * Resolves team W-L records across a list of teams/seasons.
 * Prefers the season_standings snapshot table when published for a team's season,
 * falling back to the live roster_standings computed view cleanly when no snapshot exists.
 * This guarantees public team pages and standings pages report identical W-L numbers.
 */
export async function getTeamStandingsRecords(
  teamsList: Array<{ teamId: string; seasonId: string; schoolId: string }>
): Promise<Map<string, { wins: number; losses: number }>> {
  if (teamsList.length === 0) return new Map();

  const teamIds = teamsList.map((t) => t.teamId);
  const seasonIds = Array.from(new Set(teamsList.map((t) => t.seasonId)));
  const teamById = new Map(teamsList.map((t) => [t.teamId, t]));

  const [snapshotRows, seasonFormats, computedRows] = await Promise.all([
    seasonIds.length > 0
      ? db
          .select({
            seasonId: schema.seasonStandings.seasonId,
            schoolId: schema.seasonStandings.schoolId,
            division: schema.seasonStandings.division,
            wins: schema.seasonStandings.wins,
            losses: schema.seasonStandings.losses,
          })
          .from(schema.seasonStandings)
          .where(inArray(schema.seasonStandings.seasonId, seasonIds))
      : [],
    seasonIds.length > 0
      ? db
          .select({
            id: schema.seasons.id,
            standingsFormat: schema.seasons.standingsFormat,
          })
          .from(schema.seasons)
          .where(inArray(schema.seasons.id, seasonIds))
      : [],
    teamIds.length > 0
      ? db
          .select()
          .from(schema.rosterStandings)
          .where(inArray(schema.rosterStandings.teamId, teamIds))
      : [],
  ]);

  const formatBySeasonId = new Map(
    seasonFormats.map((s) => [s.id, toStandingsFormat(s.standingsFormat)])
  );
  const seasonsWithSnapshot = new Set(snapshotRows.map((s) => s.seasonId));
  const recordMap = new Map<string, { wins: number; losses: number }>();

  // 1. Fill from snapshot for seasons that have snapshot rows
  for (const team of teamsList) {
    if (seasonsWithSnapshot.has(team.seasonId)) {
      const format = formatBySeasonId.get(team.seasonId) ?? 'divided';
      const teamSnapshots = snapshotRows.filter(
        (s) => s.seasonId === team.seasonId && s.schoolId === team.schoolId
      );
      for (const snap of teamSnapshots) {
        const canonical = canonicalDivision(snap.division);
        const val = { wins: snap.wins ?? 0, losses: snap.losses ?? 0 };
        recordMap.set(`${team.teamId}-${canonical}`, val);
        recordMap.set(`${team.teamId}-${snap.division}`, val);
        if (format === 'combined') {
          const combinedKey = `${team.teamId}-Combined`;
          if (!recordMap.has(combinedKey) || canonical === 'Varsity') {
            recordMap.set(combinedKey, val);
          }
        }
      }
    }
  }

  // 2. Fall back to computed roster_standings for missing keys
  for (const comp of computedRows) {
    if (!comp.teamId) continue;
    const team = teamById.get(comp.teamId);
    if (!team) continue;

    const canonical = canonicalDivision(comp.division);
    const keyCanonical = `${comp.teamId}-${canonical}`;
    const keyRaw = `${comp.teamId}-${comp.division}`;

    if (!recordMap.has(keyCanonical) && !recordMap.has(keyRaw)) {
      const val = { wins: comp.wins ?? 0, losses: comp.losses ?? 0 };
      recordMap.set(keyCanonical, val);
      recordMap.set(keyRaw, val);
    }
  }

  return recordMap;
}

export const getCachedRosters = unstable_cache(
  async () => {
    return db.select().from(schema.rosterStandings);
  },
  ['rosters-list'],
  { tags: ['rosters'] }
);

export async function getGameSeasonSummary(seasonId: string) {
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
        notes: schema.seasonStandings.notes,
      })
      .from(schema.seasonStandings)
      .innerJoin(schema.schools, eq(schema.seasonStandings.schoolId, schema.schools.id))
      .where(eq(schema.seasonStandings.seasonId, seasonId))
      .orderBy(sql`${schema.seasonStandings.rank} asc nulls last`, asc(schema.schools.name)),
    readStandingsFormat(seasonId),
  ]);
  const combined = standingsFormat === 'combined';

  const hasSnapshot = (division: HubDivision) =>
    combined ? snapshot.length > 0 : snapshot.some((r) => toHubDivision(r.division) === division);
  const divisionRows = async (division: HubDivision) => {
    if (hasSnapshot(division)) {
      return combined ? snapshot : snapshot.filter((r) => toHubDivision(r.division) === division);
    }
    return (await getSeasonStandingsFor(seasonId, division, standingsFormat)).rows;
  };
  const combinedRows = combined ? await divisionRows('Varsity') : [];
  const [varsityRows, jvRows] = combined
    ? [combinedRows, combinedRows]
    : await Promise.all([divisionRows('Varsity'), divisionRows('JV')]);
  const varsityTeams = varsityRows.filter((r) => r.playerName === null);
  const jvTeams = jvRows.filter((r) => r.playerName === null);

  const topFive = (rows: typeof varsityTeams) =>
    rows.slice(0, 5).map((r, i) => ({
      rank: r.rank ?? i + 1,
      team: r.schoolName,
      teamLabel: standingsTeamLabel(r, standingsFormat),
      division: canonicalDivision(r.division),
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      winPct: r.winPct ?? 0,
    }));

  return {
    standingsFormat,
    standingsReconstructed: isDerivedStandings(snapshot),
    topTeams: topFive(varsityTeams),
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

export async function getSeasonStandingsForEditor(seasonId: string) {
  return db
    .select({
      id: schema.seasonStandings.id,
      seasonId: schema.seasonStandings.seasonId,
      schoolId: schema.seasonStandings.schoolId,
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
    .where(eq(schema.seasonStandings.seasonId, seasonId))
    .orderBy(
      asc(schema.seasonStandings.division),
      sql`${schema.seasonStandings.rank} asc nulls last`,
      asc(schema.schools.name)
    );
}

export type StandingRowForEditor = Awaited<ReturnType<typeof getSeasonStandingsForEditor>>[number];

export async function createSeasonStandingInDb(values: typeof schema.seasonStandings.$inferInsert) {
  const res = await db.insert(schema.seasonStandings).values(values).returning();
  return res[0];
}

export async function updateSeasonStandingInDb(
  id: string,
  values: Partial<typeof schema.seasonStandings.$inferInsert>
) {
  const res = await db
    .update(schema.seasonStandings)
    .set(values)
    .where(eq(schema.seasonStandings.id, id))
    .returning();
  return res[0];
}

export async function deleteSeasonStandingInDb(id: string) {
  await db.delete(schema.seasonStandings).where(eq(schema.seasonStandings.id, id));
}

export async function deleteDivisionStandingsInDb(seasonId: string, division: string) {
  await db
    .delete(schema.seasonStandings)
    .where(
      and(
        eq(schema.seasonStandings.seasonId, seasonId),
        eq(schema.seasonStandings.division, division)
      )
    );
}

export async function updateSeasonStandingsFormatInDb(
  seasonId: string,
  format: 'divided' | 'combined'
) {
  await db
    .update(schema.seasons)
    .set({ standingsFormat: format })
    .where(eq(schema.seasons.id, seasonId));
}
