import 'server-only';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import {
  buildSeasonBlocks,
  type RosterEditOptions,
  type RosterViewContentOverride,
  type RosterViewPlayer,
  type RosterViewRoster,
  type SchoolRosterTeamInput,
  type SeasonBlock,
} from '@/app/lib/school-roster-view';

/**
 * Roster data for one school, across every game and season, for the staff
 * Schools & Rosters page (where staff also edit it). Deliberately uncached
 * (admin reads are raw so an edit shows immediately) and limited to the
 * columns the admin roster views already show. `student_demographics` is never joined: it
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
          memberId: schema.players.memberId,
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

  // Content overrides for the members on these rosters. Read only here, for the MANAGE_ROSTERS roster page.
  const memberIds = [...new Set(playerRows.map((p) => p.memberId))];
  const overrideRows = memberIds.length
    ? await db
        .select({
          id: schema.onboardingContentOverrides.id,
          memberId: schema.onboardingContentOverrides.memberId,
          field: schema.onboardingContentOverrides.field,
          submittedValue: schema.onboardingContentOverrides.submittedValue,
          createdAt: schema.onboardingContentOverrides.createdAt,
          reviewedAt: schema.onboardingContentOverrides.reviewedAt,
          reviewedBy: schema.onboardingContentOverrides.reviewedBy,
          reviewNote: schema.onboardingContentOverrides.reviewNote,
        })
        .from(schema.onboardingContentOverrides)
        .where(inArray(schema.onboardingContentOverrides.memberId, memberIds))
        .orderBy(asc(schema.onboardingContentOverrides.createdAt))
    : [];
  const overridesByMember = new Map<string, RosterViewContentOverride[]>();
  for (const o of overrideRows) {
    const list = overridesByMember.get(o.memberId) ?? [];
    list.push({
      id: o.id,
      field: o.field,
      submittedValue: o.submittedValue,
      createdAt: o.createdAt,
      reviewedAt: o.reviewedAt,
      reviewedBy: o.reviewedBy,
      reviewNote: o.reviewNote,
    });
    overridesByMember.set(o.memberId, list);
  }

  const playersByRoster = new Map<string, RosterViewPlayer[]>();
  for (const p of playerRows) {
    const list = playersByRoster.get(p.rosterId) ?? [];
    list.push({
      id: p.id,
      memberId: p.memberId,
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName} ${p.lastName}`.trim(),
      ign: p.ign,
      discord: p.discord,
      graduationYear: p.graduationYear,
      role: p.role,
      contentOverrides: overridesByMember.get(p.memberId) ?? [],
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

/** What the staff editing controls need beyond the rosters themselves. Never reads demographics. */
export async function getRosterEditOptions(schoolId: string): Promise<RosterEditOptions> {
  const [members, games, seasons] = await Promise.all([
    db
      .select({
        id: schema.members.id,
        firstName: schema.members.firstName,
        lastName: schema.members.lastName,
        discord: schema.members.discord,
        graduationYear: schema.members.graduationYear,
      })
      .from(schema.members)
      .where(eq(schema.members.schoolId, schoolId))
      .orderBy(asc(schema.members.firstName), asc(schema.members.lastName)),
    db
      .select({ id: schema.games.id, slug: schema.games.slug, name: schema.games.displayName })
      .from(schema.games)
      .orderBy(asc(schema.games.displayName)),
    db
      .select({
        id: schema.seasons.id,
        gameId: schema.seasons.gameId,
        name: schema.seasons.name,
        isActive: schema.seasons.isActive,
      })
      .from(schema.seasons),
  ]);
  return { members, games, seasons };
}
