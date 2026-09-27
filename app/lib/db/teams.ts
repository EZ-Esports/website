import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { and, asc, count, desc, eq, inArray, isNull, notExists } from 'drizzle-orm';
import { canonicalDivision } from './match-page';
import { slugify } from '@/app/lib/text-utils';
import { getTeamStandingsRecords } from './standings';

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

export const getCachedPlayers = unstable_cache(
  async () => {
    return db.select().from(schema.players);
  },
  ['players-list'],
  { tags: ['players'] }
);

/** Count teams that do not yet have a single roster created. */
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

// --- PUBLIC TEAMS PAGE DATA DAL ---

export interface PublicPlayerItem {
  name: string;
  role: string;
  bio: string;
  isCaptain?: boolean;
}

export interface PublicRosterItem {
  id: string;
  name: string;
  division: string;
  record: string;
  players: PublicPlayerItem[];
}

export interface PublicSeasonTeamSnapshot {
  seasonId: string;
  seasonName: string;
  isSeasonActive?: boolean;
  rosters: PublicRosterItem[];
}

export interface PublicSchoolGroup {
  schoolId: string;
  schoolName: string;
  schoolSlug?: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  seasons: PublicSeasonTeamSnapshot[];
}

export interface PublicSchoolDetailData {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  seasons: PublicSeasonTeamSnapshot[];
}

export async function getGameTeamsPageData(gameSlug: string): Promise<PublicSchoolGroup[] | null> {
  const gameRow = await db
    .select()
    .from(schema.games)
    .where(eq(schema.games.slug, gameSlug))
    .limit(1);

  if (!gameRow[0]) return null;

  const teamsList = await db
    .select({
      teamId: schema.teams.id,
      schoolId: schema.teams.schoolId,
      gameId: schema.teams.gameId,
      seasonId: schema.teams.seasonId,
      schoolName: schema.schools.name,
      schoolSlug: schema.schools.slug,
      logoUrl: schema.schools.logoUrl,
      websiteUrl: schema.schools.websiteUrl,
      seasonName: schema.seasons.name,
      isSeasonActive: schema.seasons.isActive,
    })
    .from(schema.teams)
    .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
    .innerJoin(schema.seasons, eq(schema.teams.seasonId, schema.seasons.id))
    .where(and(eq(schema.teams.gameId, gameRow[0].id), isNull(schema.schools.deletedAt)))
    .orderBy(schema.schools.name, desc(schema.seasons.name));

  const teamIds = teamsList.map((t) => t.teamId);
  if (teamIds.length === 0) return [];

  const rostersList = await db
    .select()
    .from(schema.rosters)
    .where(inArray(schema.rosters.teamId, teamIds));

  const rosterIds = rostersList.map((r) => r.id);
  const playersList =
    rosterIds.length > 0
      ? await db
          .select({
            id: schema.players.id,
            rosterId: schema.players.rosterId,
            memberId: schema.players.memberId,
            role: schema.players.role,
            ign: schema.players.ign,
            bio: schema.players.bio,
            isCaptain: schema.players.isCaptain,
            firstName: schema.members.firstName,
            lastName: schema.members.lastName,
          })
          .from(schema.players)
          .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
          .where(inArray(schema.players.rosterId, rosterIds))
      : [];

  const standingsMap = await getTeamStandingsRecords(teamsList);

  const playersByRoster = new Map<string, PublicPlayerItem[]>();
  playersList.forEach((p) => {
    const arr = playersByRoster.get(p.rosterId) || [];
    arr.push({
      name: p.ign ? `${p.firstName} "${p.ign}" ${p.lastName}` : `${p.firstName} ${p.lastName}`,
      role: p.role.charAt(0).toUpperCase() + p.role.slice(1),
      bio: p.bio || 'Active Player',
      isCaptain: p.isCaptain || p.role.toLowerCase() === 'captain',
    });
    playersByRoster.set(p.rosterId, arr);
  });

  const rostersByTeam = new Map<string, PublicRosterItem[]>();
  rostersList.forEach((r) => {
    const arr = rostersByTeam.get(r.teamId) || [];
    const standing =
      standingsMap.get(`${r.teamId}-${r.division}`) ??
      standingsMap.get(`${r.teamId}-${canonicalDivision(r.division)}`) ??
      standingsMap.get(`${r.teamId}-Combined`);
    arr.push({
      id: r.id,
      name: r.name,
      division: r.division,
      record: standing ? `${standing.wins}-${standing.losses}` : 'Unpublished',
      players: playersByRoster.get(r.id) || [],
    });
    rostersByTeam.set(r.teamId, arr);
  });

  const schoolsMap = new Map<string, PublicSchoolGroup>();
  teamsList.forEach((t) => {
    let school = schoolsMap.get(t.schoolId);
    if (!school) {
      school = {
        schoolId: t.schoolId,
        schoolName: t.schoolName,
        schoolSlug: t.schoolSlug || slugify(t.schoolName),
        logoUrl: t.logoUrl,
        websiteUrl: t.websiteUrl,
        seasons: [],
      };
      schoolsMap.set(t.schoolId, school);
    }
    const rosters = rostersByTeam.get(t.teamId) || [];
    school.seasons.push({
      seasonId: t.seasonId,
      seasonName: t.seasonName,
      isSeasonActive: t.isSeasonActive,
      rosters,
    });
  });

  return Array.from(schoolsMap.values()).filter(
    (s) => s.seasons.some((season) => season.rosters.length > 0)
  );
}

export async function getSchoolGameTeamsPageData(
  gameSlug: string,
  schoolParam: string
): Promise<PublicSchoolDetailData | null> {
  const gameRow = await db
    .select()
    .from(schema.games)
    .where(eq(schema.games.slug, gameSlug))
    .limit(1);

  if (!gameRow[0]) return null;

  const allSchools = await getCachedSchools();
  const matchedSchoolRow = allSchools.find(
    (s) => s.slug === schoolParam || slugify(s.name) === schoolParam || s.id === schoolParam
  );

  if (!matchedSchoolRow) return null;

  const teamsList = await db
    .select({
      teamId: schema.teams.id,
      schoolId: schema.teams.schoolId,
      gameId: schema.teams.gameId,
      seasonId: schema.teams.seasonId,
      seasonName: schema.seasons.name,
      isSeasonActive: schema.seasons.isActive,
    })
    .from(schema.teams)
    .innerJoin(schema.seasons, eq(schema.teams.seasonId, schema.seasons.id))
    .where(
      and(
        eq(schema.teams.schoolId, matchedSchoolRow.id),
        eq(schema.teams.gameId, gameRow[0].id)
      )
    )
    .orderBy(desc(schema.seasons.name));

  const teamIds = teamsList.map((t) => t.teamId);
  const rostersList =
    teamIds.length > 0
      ? await db
          .select()
          .from(schema.rosters)
          .where(inArray(schema.rosters.teamId, teamIds))
      : [];

  const rosterIds = rostersList.map((r) => r.id);
  const playersList =
    rosterIds.length > 0
      ? await db
          .select({
            id: schema.players.id,
            rosterId: schema.players.rosterId,
            memberId: schema.players.memberId,
            role: schema.players.role,
            ign: schema.players.ign,
            bio: schema.players.bio,
            isCaptain: schema.players.isCaptain,
            firstName: schema.members.firstName,
            lastName: schema.members.lastName,
          })
          .from(schema.players)
          .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
          .where(inArray(schema.players.rosterId, rosterIds))
      : [];

  const standingsMap = await getTeamStandingsRecords(
    teamsList.map((t) => ({ ...t, schoolId: matchedSchoolRow.id }))
  );

  const playersByRoster = new Map<string, PublicPlayerItem[]>();
  playersList.forEach((p) => {
    const arr = playersByRoster.get(p.rosterId) || [];
    arr.push({
      name: p.ign ? `${p.firstName} "${p.ign}" ${p.lastName}` : `${p.firstName} ${p.lastName}`,
      role: p.role.charAt(0).toUpperCase() + p.role.slice(1),
      bio: p.bio || 'Active Player',
      isCaptain: p.isCaptain || p.role.toLowerCase() === 'captain',
    });
    playersByRoster.set(p.rosterId, arr);
  });

  const rostersByTeam = new Map<string, PublicRosterItem[]>();
  rostersList.forEach((r) => {
    const arr = rostersByTeam.get(r.teamId) || [];
    const standing =
      standingsMap.get(`${r.teamId}-${r.division}`) ??
      standingsMap.get(`${r.teamId}-${canonicalDivision(r.division)}`) ??
      standingsMap.get(`${r.teamId}-Combined`);
    arr.push({
      id: r.id,
      name: r.name,
      division: r.division,
      record: standing ? `${standing.wins}-${standing.losses}` : 'Unpublished',
      players: playersByRoster.get(r.id) || [],
    });
    rostersByTeam.set(r.teamId, arr);
  });

  const seasonsList: PublicSeasonTeamSnapshot[] = teamsList
    .map((t) => ({
      seasonId: t.seasonId,
      seasonName: t.seasonName,
      isSeasonActive: t.isSeasonActive,
      rosters: rostersByTeam.get(t.teamId) || [],
    }))
    .filter((s) => s.rosters.length > 0);

  return {
    schoolId: matchedSchoolRow.id,
    schoolName: matchedSchoolRow.name,
    schoolSlug: matchedSchoolRow.slug || slugify(matchedSchoolRow.name),
    logoUrl: matchedSchoolRow.logoUrl,
    websiteUrl: matchedSchoolRow.websiteUrl,
    seasons: seasonsList,
  };
}
