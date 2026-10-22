import 'server-only';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import {
  buildSeasonBlocks,
  type RosterViewPlayer,
  type RosterViewRoster,
  type SchoolRosterTeamInput,
  type SeasonBlock,
} from '@/app/lib/school-roster-view';

/**
 * Read-only roster data for one school, across every game and season, for the
 * staff Schools -> View rosters page. Deliberately uncached (admin reads are
 * raw so an edit elsewhere shows immediately) and limited to the columns the
 * admin roster views already show. `student_demographics` is never joined: it
 * has its own permission (VIEW_STUDENT_DEMOGRAPHICS). Callers must have already
 * checked MANAGE_ROSTERS.
 */
export async function getSchoolRosterBlocks(schoolId: string): Promise<SeasonBlock[]> {
  const teams = await db
    .select({
      teamId: schema.teams.id,
      gameId: schema.games.id,
      gameSlug: schema.games.slug,
      gameName: schema.games.displayName,
      seasonId: schema.seasons.id,
      seasonName: schema.seasons.name,
      seasonIsActive: schema.seasons.isActive,
      rostersLockedAt: schema.seasons.rostersLockedAt,
    })
    .from(schema.teams)
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .innerJoin(schema.seasons, eq(schema.teams.seasonId, schema.seasons.id))
    .where(eq(schema.teams.schoolId, schoolId));

  if (teams.length === 0) return [];

  const rosterRows = await db
    .select({
      id: schema.rosters.id,
      teamId: schema.rosters.teamId,
      name: schema.rosters.name,
      division: schema.rosters.division,
    })
    .from(schema.rosters)
    .where(inArray(schema.rosters.teamId, teams.map((t) => t.teamId)))
    .orderBy(asc(schema.rosters.name));

  const playerRows = rosterRows.length
    ? await db
        .select({
          id: schema.players.id,
          rosterId: schema.players.rosterId,
          role: schema.players.role,
          ign: schema.players.ign,
          firstName: schema.members.firstName,
          lastName: schema.members.lastName,
          discord: schema.members.discord,
          graduationYear: schema.members.graduationYear,
        })
        .from(schema.players)
        .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
        .where(inArray(schema.players.rosterId, rosterRows.map((r) => r.id)))
    : [];

  const playersByRoster = new Map<string, RosterViewPlayer[]>();
  for (const p of playerRows) {
    const list = playersByRoster.get(p.rosterId) ?? [];
    list.push({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      ign: p.ign,
      discord: p.discord,
      graduationYear: p.graduationYear,
      role: p.role,
    });
    playersByRoster.set(p.rosterId, list);
  }

  const rostersByTeam = new Map<string, RosterViewRoster[]>();
  for (const r of rosterRows) {
    const list = rostersByTeam.get(r.teamId) ?? [];
    list.push({ id: r.id, name: r.name, division: r.division, players: playersByRoster.get(r.id) ?? [] });
    rostersByTeam.set(r.teamId, list);
  }

  const input: SchoolRosterTeamInput[] = teams.map((t) => ({
    ...t,
    rosters: rostersByTeam.get(t.teamId) ?? [],
  }));
  return buildSeasonBlocks(input);
}

/** School name for the page header; null when the id matches no live school. */
export async function getSchoolForRosterView(schoolId: string) {
  const [school] = await db
    .select({ id: schema.schools.id, name: schema.schools.name })
    .from(schema.schools)
    .where(and(eq(schema.schools.id, schoolId), isNull(schema.schools.deletedAt)))
    .limit(1);
  return school ?? null;
}
