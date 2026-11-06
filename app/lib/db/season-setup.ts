import 'server-only';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';
import { canonicalDivision, type CanonicalDivision } from './match-page';
import { missingDivisions } from '@/app/lib/season-schools';

/**
 * Everything the staff season page (League Setup -> season) shows, read raw and uncached like the
 * other admin reads so a write shows on the next render. Callers must have checked MANAGE_LEAGUE.
 * Players carry only a display name and role; edits go through the school's roster editor.
 */

export interface SeasonSetupPlayer {
  id: string;
  name: string;
  role: string;
}

export interface SeasonSetupRoster {
  id: string;
  name: string;
  division: CanonicalDivision;
  players: SeasonSetupPlayer[];
}

export interface SeasonSetupSchool {
  schoolId: string;
  schoolName: string;
  logoUrl: string | null;
  teamId: string;
  rosters: SeasonSetupRoster[];
  /** Divisions the game fields that this school has no roster for (a repair is one "Add school" away). */
  missing: CanonicalDivision[];
}

export interface SeasonSetupData {
  season: {
    id: string;
    name: string;
    isActive: boolean;
    standingsFormat: string;
    rostersLockedAt: Date | null;
    outcomesFinalizedAt: Date | null;
    gameId: string;
    gameName: string;
    gameSlug: string;
  };
  schools: SeasonSetupSchool[];
  /** Live schools with no team in this season yet, for the add picker. */
  /** `existingRosters`: rosters the school already has this season (a removed school); adding it back restores them. */
  availableSchools: Array<{ id: string; name: string; existingRosters: number }>;
}

const DIVISION_ORDER: Record<CanonicalDivision, number> = { Varsity: 0, JV: 1, All: 2 };

export async function getSeasonSetupData(seasonId: string): Promise<SeasonSetupData | null> {
  const [season] = await db
    .select({
      id: schema.seasons.id,
      name: schema.seasons.name,
      isActive: schema.seasons.isActive,
      standingsFormat: schema.seasons.standingsFormat,
      rostersLockedAt: schema.seasons.rostersLockedAt,
      outcomesFinalizedAt: schema.seasons.outcomesFinalizedAt,
      gameId: schema.games.id,
      gameName: schema.games.displayName,
      gameSlug: schema.games.slug,
    })
    .from(schema.seasons)
    .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
    .where(eq(schema.seasons.id, seasonId))
    .limit(1);
  if (!season) return null;

  const [teams, allSchools] = await Promise.all([
    db
      .select({
        teamId: schema.seasonSchools.id,
        schoolId: schema.schools.id,
        schoolName: schema.schools.name,
        logoUrl: schema.schools.logoUrl,
      })
      .from(schema.seasonSchools)
      .innerJoin(schema.schools, eq(schema.seasonSchools.schoolId, schema.schools.id))
      .where(and(eq(schema.seasonSchools.seasonId, seasonId), isNull(schema.schools.deletedAt)))
      .orderBy(asc(schema.schools.name)),
    db
      .select({ id: schema.schools.id, name: schema.schools.name })
      .from(schema.schools)
      .where(isNull(schema.schools.deletedAt))
      .orderBy(asc(schema.schools.name)),
  ]);

  // Every roster of the season, by school: rosters belong to the school and season themselves, so a
  // school that is not a member (removed) still has its rosters here, ready to be restored by Add school.
  const rosterRows = await db
    .select({
      id: schema.rosters.id,
      schoolId: schema.rosters.schoolId,
      name: schema.rosters.name,
      division: schema.rosters.division,
    })
    .from(schema.rosters)
    .where(eq(schema.rosters.seasonId, seasonId));

  const playerRows = rosterRows.length
    ? await db
        .select({
          id: schema.players.id,
          rosterId: schema.players.rosterId,
          role: schema.players.role,
          firstName: schema.members.firstName,
          lastName: schema.members.lastName,
        })
        .from(schema.players)
        .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
        .where(inArray(schema.players.rosterId, rosterRows.map((r) => r.id)))
    : [];

  const playersByRoster = new Map<string, SeasonSetupPlayer[]>();
  for (const p of playerRows) {
    const list = playersByRoster.get(p.rosterId) ?? [];
    list.push({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), role: p.role });
    playersByRoster.set(p.rosterId, list);
  }
  for (const list of playersByRoster.values()) {
    list.sort((a, b) => Number(b.role === 'captain') - Number(a.role === 'captain') || a.name.localeCompare(b.name));
  }

  const rostersBySchool = new Map<string, SeasonSetupRoster[]>();
  for (const r of rosterRows) {
    const list = rostersBySchool.get(r.schoolId) ?? [];
    list.push({ id: r.id, name: r.name, division: canonicalDivision(r.division), players: playersByRoster.get(r.id) ?? [] });
    rostersBySchool.set(r.schoolId, list);
  }

  const all = teams.map<SeasonSetupSchool>((t) => {
    const rosters = (rostersBySchool.get(t.schoolId) ?? []).sort(
      (a, b) => DIVISION_ORDER[a.division] - DIVISION_ORDER[b.division] || a.name.localeCompare(b.name),
    );
    return {
      schoolId: t.schoolId,
      schoolName: t.schoolName,
      logoUrl: t.logoUrl,
      teamId: t.teamId,
      rosters,
      // An archived season is not set up any more, so it never asks for missing rosters.
      missing: season.isActive ? missingDivisions(season.gameSlug, rosters) : [],
    };
  });
  // Every member is listed (spec-060): season membership alone decides who is in a season, rosters or not.
  const schools = all;

  const inSeason = new Set(all.map((s) => s.schoolId));
  return {
    season: {
      ...season,
      standingsFormat: season.standingsFormat,
    },
    schools,
    availableSchools: allSchools
      .filter((s) => !inSeason.has(s.id))
      .map((s) => ({ ...s, existingRosters: rostersBySchool.get(s.id)?.length ?? 0 })),
  };
}
