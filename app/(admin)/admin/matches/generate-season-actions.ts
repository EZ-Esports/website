'use server';

import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { revalidatePath, updateTag } from 'next/cache';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { canonicalDivision } from '@/app/lib/db/match-page';
import { allowedRosterDivisions } from '@/app/lib/school-roster-view';
import { buildSeasonPlan, type SeasonPlan } from '@/app/lib/season-generation';
import { isValidYmd, validateParticipantCount } from '@/app/lib/season-schedule';

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface GeneratePreviewMatch {
  homeName: string;
  awayName: string;
}

export interface GeneratePreview {
  seasonName: string;
  gameName: string;
  division: 'Varsity' | 'JV';
  teamsToCreate: string[];
  rostersToCreate: string[];
  /** Schools whose existing team and roster are used as they are. */
  reusedSchools: string[];
  weeks: Array<{ round: number; kickoffIso: string; matches: GeneratePreviewMatch[] }>;
  matchCount: number;
  /** Echoed back on confirm so the write can prove it matches what staff reviewed. */
  fingerprint: string;
}

export type GenerateSeasonResult =
  | { success: true; preview: GeneratePreview }
  | { success: false; error: string };

export type CommitSeasonResult =
  | { success: true; teamsCreated: number; matchesCreated: number }
  | { success: false; error: string };

const inputSchema = z.object({
  seasonId: z.string().uuid(),
  division: z.enum(['Varsity', 'JV']),
  schoolIds: z.array(z.string().uuid()).max(200),
  startDate: z.string().refine(isValidYmd, 'Enter a valid first-week date.'),
});

/** Thrown to abort the transaction with a message staff can act on. */
class GenerateError extends Error {}

function revalidateGenerated() {
  updateTag('matches');
  updateTag('rosters');
  updateTag('teams');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

interface Loaded {
  plan: SeasonPlan;
  schoolNames: Map<string, string>;
  seasonName: string;
  gameName: string;
  teams: Array<{ id: string; schoolId: string }>;
  rosters: Array<{ id: string; teamId: string; name: string; division: string }>;
  gameId: string;
}

/**
 * Reads everything the plan depends on and refuses anything that would corrupt a season.
 * Runs inside the commit transaction (after locking the season row) so the "no matches yet" check
 * and the inserts are one atomic step; the preview runs the same code against the plain client.
 */
async function loadPlan(exec: Pick<typeof db, 'select'>, raw: z.infer<typeof inputSchema>): Promise<Loaded> {
  const unique = [...new Set(raw.schoolIds)];
  if (unique.length !== raw.schoolIds.length) throw new GenerateError('Each school can only be selected once.');
  const countProblem = validateParticipantCount(unique.length);
  if (countProblem) throw new GenerateError(countProblem);

  const [season] = await exec
    .select({
      id: schema.seasons.id,
      name: schema.seasons.name,
      gameId: schema.seasons.gameId,
      gameName: schema.games.displayName,
      gameSlug: schema.games.slug,
    })
    .from(schema.seasons)
    .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
    .where(eq(schema.seasons.id, raw.seasonId))
    .limit(1);
  if (!season) throw new GenerateError('That season no longer exists.');

  // Tournament games have no regular-season round robin; Varsity/JV only exist for team games.
  if (!allowedRosterDivisions(season.gameSlug).includes(raw.division)) {
    throw new GenerateError(`${season.gameName} does not have a ${raw.division} division.`);
  }

  // Only matches in the chosen division block: Varsity and JV are separate competitions, so each
  // can be generated once, in either order. A match counts when either of its rosters is in the division.
  const awayRoster = alias(schema.rosters, 'away_roster');
  const seasonMatches = await exec
    .select({ homeDivision: schema.rosters.division, awayDivision: awayRoster.division })
    .from(schema.matches)
    .innerJoin(schema.rosters, eq(schema.matches.homeRosterId, schema.rosters.id))
    .innerJoin(awayRoster, eq(schema.matches.awayRosterId, awayRoster.id))
    .where(eq(schema.matches.seasonId, season.id));
  const existingCount = seasonMatches.filter(
    (m) => canonicalDivision(m.homeDivision) === raw.division || canonicalDivision(m.awayDivision) === raw.division
  ).length;
  if (existingCount > 0) {
    throw new GenerateError(
      `${season.name} already has ${existingCount} ${raw.division} match${existingCount === 1 ? '' : 'es'}. Generate only works once per division; delete those matches first or schedule individually.`
    );
  }

  const schools = await exec
    .select({ id: schema.schools.id, name: schema.schools.name })
    .from(schema.schools)
    .where(and(inArray(schema.schools.id, unique), eq(schema.schools.isActive, true), isNull(schema.schools.deletedAt)));
  if (schools.length !== unique.length) {
    throw new GenerateError('One or more selected schools no longer exist or are inactive. Reload and try again.');
  }

  const teams = await exec
    .select({ id: schema.teams.id, schoolId: schema.teams.schoolId })
    .from(schema.teams)
    .where(and(eq(schema.teams.seasonId, season.id), eq(schema.teams.gameId, season.gameId), inArray(schema.teams.schoolId, unique)));
  const rosters = teams.length
    ? await exec
        .select({ id: schema.rosters.id, teamId: schema.rosters.teamId, name: schema.rosters.name, division: schema.rosters.division })
        .from(schema.rosters)
        .where(inArray(schema.rosters.teamId, teams.map((t) => t.id)))
    : [];

  const plan = buildSeasonPlan({
    seasonId: season.id,
    startYmd: raw.startDate,
    division: raw.division,
    schools,
    existingTeams: teams,
    existingRosters: rosters,
  });
  return {
    plan,
    schoolNames: new Map(schools.map((s) => [s.id, s.name])),
    seasonName: season.name,
    gameName: season.gameName,
    teams,
    rosters,
    gameId: season.gameId,
  };
}

type ParsedInput = { error: string; data?: undefined } | { data: z.infer<typeof inputSchema>; error?: undefined };

function parseInput(input: unknown): ParsedInput {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  return { data: parsed.data };
}

/** Dry run: writes nothing. Returns what a confirm would create so staff can review it. */
export async function previewGenerateSeason(input: unknown): Promise<GenerateSeasonResult> {
  await requirePermission(Permissions.MANAGE_MATCHES);
  const parsed = parseInput(input);
  if (parsed.error !== undefined) return { success: false, error: parsed.error };

  try {
    const { plan, schoolNames, seasonName, gameName } = await loadPlan(db, parsed.data!);
    const name = (id: string) => schoolNames.get(id) ?? id;
    return {
      success: true,
      preview: {
        seasonName,
        gameName,
        division: parsed.data.division,
        teamsToCreate: plan.teamsToCreate.map((s) => s.name),
        rostersToCreate: plan.rostersToCreate.map((s) => s.name),
        reusedSchools: plan.reusedRosters.map((s) => s.name),
        weeks: plan.rounds.map((r) => ({
          round: r.round,
          kickoffIso: plan.matches.find((m) => m.round === r.round)!.kickoff.toISOString(),
          matches: r.pairs.map((p) => ({ homeName: name(p.homeId), awayName: name(p.awayId) })),
        })),
        matchCount: plan.matches.length,
        fingerprint: plan.fingerprint,
      },
    };
  } catch (error) {
    if (error instanceof GenerateError) return { success: false, error: error.message };
    console.error('Failed to preview season generation', error);
    return { success: false, error: 'Could not build the preview. Please try again.' };
  }
}

/**
 * Writes the previewed teams, rosters and matches in one transaction. The season row is locked
 * first so two staff members confirming at once serialize, and the second finds matches already
 * present and is refused instead of doubling the schedule.
 */
export async function commitGenerateSeason(input: unknown, fingerprint: unknown): Promise<CommitSeasonResult> {
  await requirePermission(Permissions.MANAGE_MATCHES);
  const parsed = parseInput(input);
  if (parsed.error !== undefined) return { success: false, error: parsed.error };
  if (typeof fingerprint !== 'string' || !fingerprint) return { success: false, error: 'Preview the schedule before confirming.' };

  try {
    const result = await db.transaction(async (tx: Executor) => {
      await tx.select({ id: schema.seasons.id }).from(schema.seasons).where(eq(schema.seasons.id, parsed.data.seasonId)).for('update');

      const loaded = await loadPlan(tx, parsed.data);
      const { plan } = loaded;
      if (plan.fingerprint !== fingerprint) {
        throw new GenerateError('The schedule changed since you previewed it. Preview it again before confirming.');
      }

      const teamIdBySchool = new Map(loaded.teams.map((t) => [t.schoolId, t.id]));
      if (plan.teamsToCreate.length) {
        const created = await tx
          .insert(schema.teams)
          .values(plan.teamsToCreate.map((s) => ({ schoolId: s.id, gameId: loaded.gameId, seasonId: parsed.data.seasonId })))
          .returning({ id: schema.teams.id, schoolId: schema.teams.schoolId });
        for (const t of created) teamIdBySchool.set(t.schoolId, t.id);
      }

      const rosterIdBySchool = new Map<string, string>();
      for (const [schoolId, teamId] of teamIdBySchool) {
        const found = loaded.rosters
          .filter((r) => r.teamId === teamId && canonicalDivision(r.division) === parsed.data.division)
          .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
        if (found) rosterIdBySchool.set(schoolId, found.id);
      }
      if (plan.rostersToCreate.length) {
        const created = await tx
          .insert(schema.rosters)
          .values(
            plan.rostersToCreate.map((s) => ({
              teamId: teamIdBySchool.get(s.id)!,
              name: s.rosterName,
              division: plan.rosterDivision,
            }))
          )
          .returning({ id: schema.rosters.id, teamId: schema.rosters.teamId });
        const schoolByTeam = new Map([...teamIdBySchool].map(([schoolId, teamId]) => [teamId, schoolId]));
        for (const r of created) rosterIdBySchool.set(schoolByTeam.get(r.teamId)!, r.id);
      }

      await tx.insert(schema.matches).values(
        plan.matches.map((m) => ({
          seasonId: parsed.data.seasonId,
          homeRosterId: rosterIdBySchool.get(m.homeSchoolId)!,
          awayRosterId: rosterIdBySchool.get(m.awaySchoolId)!,
          scheduledAt: m.kickoff,
          status: 'scheduled' as const,
        }))
      );
      return { teamsCreated: plan.teamsToCreate.length, matchesCreated: plan.matches.length };
    });

    revalidateGenerated();
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof GenerateError) return { success: false, error: error.message };
    // A concurrent edit can still trip a unique index (team per season, roster name per team).
    if ((error as { code?: string; cause?: { code?: string } })?.code === '23505' || (error as { cause?: { code?: string } })?.cause?.code === '23505') {
      return { success: false, error: 'A team or roster this season needs was created by someone else just now. Nothing was saved. Preview again.' };
    }
    console.error('Failed to generate season', error);
    return { success: false, error: 'Could not generate the season. Nothing was saved. Please try again.' };
  }
}
