'use server';

import { z } from 'zod';
import { and, count, eq, isNull, or, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { dbErrorChain } from '@/app/lib/text-utils';
import { planSchoolRosters } from '@/app/lib/season-schools';

const inputSchema = z.object({
  seasonId: z.string().uuid(),
  schoolId: z.string().uuid(),
});

export type AddSchoolToSeasonResult =
  | { success: true; schoolName: string; teamCreated: boolean; restored: boolean; rostersCreated: string[] }
  | { success: false; error: string };

/**
 * Caches and pages that show a season's schools. `public` also refreshes the public pages a
 * removal or restore changes (team lists, schedule, standings, hub, archive, homepage).
 */
function refreshSeasonSchools(seasonId: string, publicPages: boolean) {
  updateTag('teams');
  updateTag('rosters');
  revalidatePath(`/admin/league/${seasonId}`, 'layout');
  revalidatePath('/admin/schools', 'layout');
  revalidatePath('/admin/matches');
  revalidatePath('/portal');
  revalidatePath('/');
  if (publicPages) {
    updateTag('matches');
    for (const path of [
      '/[game]/varsity',
      '/[game]/junior-varsity',
      '/[game]/standings',
      '/[game]/schedule',
      '/[game]/teams',
      '/[game]/teams/[school]',
    ]) {
      revalidatePath(path, 'page');
    }
    revalidatePath('/archives');
  }
}

export type RemoveSchoolFromSeasonResult =
  | { success: true; schoolName: string; alreadyRemoved: boolean; hiddenMatches: number }
  | { success: false; error: string };

/**
 * Takes a school out of one game's season WITHOUT deleting anything. A hard delete of the team
 * would cascade to its rosters and players (and fail or orphan matches, which hang off rosters),
 * so the team row stays and `teams.removed_at` is set. Every public and manager surface skips a
 * removed team and hides its matches; staff views still see them. Repeating it is a no-op, and
 * `addSchoolToSeason` clears the marker (restoring the same rosters, players and matches).
 */
export async function removeSchoolFromSeason(input: { seasonId: string; schoolId: string }): Promise<RemoveSchoolFromSeasonResult> {
  const actor = await requirePermission(Permissions.MANAGE_LEAGUE);

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Choose a school to remove.' };
  const { seasonId, schoolId } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`season-school:${seasonId}:${schoolId}`}))`);

      const [row] = await tx
        .select({ teamId: schema.teams.id, removedAt: schema.teams.removedAt, schoolName: schema.schools.name })
        .from(schema.teams)
        .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
        .where(and(eq(schema.teams.schoolId, schoolId), eq(schema.teams.seasonId, seasonId)))
        .limit(1);
      if (!row) return { success: false as const, error: 'That school is not in this season.' };

      const [{ value: hiddenMatches }] = await tx
        .select({ value: count() })
        .from(schema.matches)
        .innerJoin(schema.rosters, or(eq(schema.matches.homeRosterId, schema.rosters.id), eq(schema.matches.awayRosterId, schema.rosters.id)))
        .where(eq(schema.rosters.teamId, row.teamId));

      if (row.removedAt) {
        return { success: true as const, schoolName: row.schoolName, alreadyRemoved: true, hiddenMatches };
      }

      await tx.update(schema.teams).set({ removedAt: new Date() }).where(eq(schema.teams.id, row.teamId));
      await tx.insert(schema.staffAuditLogs).values({
        event: 'remove_school_from_season',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({ seasonId, schoolId, teamId: row.teamId, schoolName: row.schoolName, hiddenMatches }),
      });
      return { success: true as const, schoolName: row.schoolName, alreadyRemoved: false, hiddenMatches };
    });

    if (result.success && !result.alreadyRemoved) refreshSeasonSchools(seasonId, true);
    return result;
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Could not remove the school from this season.' };
  }
}

/**
 * Registers a school for a season: finds or creates its team (unique on school + game + season)
 * and gives that team a roster for every division the game fields, so managers find Varsity and
 * JV ready. Safe to repeat: an existing team is reused and only missing divisions are added, so
 * calling it twice (or racing two staff) never duplicates anything. Staff only; the manager
 * roster lock does not apply (spec-020), which is why a locked season can still be populated.
 */
export async function addSchoolToSeason(input: { seasonId: string; schoolId: string }): Promise<AddSchoolToSeasonResult> {
  await requirePermission(Permissions.MANAGE_LEAGUE);

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Choose a school to add.' };
  const { seasonId, schoolId } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [season] = await tx
        .select({ id: schema.seasons.id, gameId: schema.seasons.gameId, gameSlug: schema.games.slug })
        .from(schema.seasons)
        .innerJoin(schema.games, eq(schema.seasons.gameId, schema.games.id))
        .where(eq(schema.seasons.id, seasonId))
        .limit(1);
      if (!season) return { success: false as const, error: 'Season not found.' };

      const [school] = await tx
        .select({ id: schema.schools.id, name: schema.schools.name })
        .from(schema.schools)
        .where(and(eq(schema.schools.id, schoolId), isNull(schema.schools.deletedAt)))
        .limit(1);
      if (!school) return { success: false as const, error: 'School not found.' };

      // Serializes two staff adding the same school at once; the unique indexes stay the backstop.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`season-school:${seasonId}:${schoolId}`}))`);

      const [existingTeam] = await tx
        .select({ id: schema.teams.id, removedAt: schema.teams.removedAt })
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.schoolId, schoolId),
            eq(schema.teams.gameId, season.gameId),
            eq(schema.teams.seasonId, seasonId),
          ),
        )
        .limit(1);

      let teamId = existingTeam?.id;
      let teamCreated = false;
      let restored = false;
      if (existingTeam?.removedAt) {
        // Adding a removed school back: the same team row (and so its rosters, players and matches)
        // comes back; nothing new is created for it unless a division has no roster.
        await tx.update(schema.teams).set({ removedAt: null }).where(eq(schema.teams.id, existingTeam.id));
        restored = true;
      }
      if (!teamId) {
        const [created] = await tx
          .insert(schema.teams)
          .values({ schoolId, gameId: season.gameId, seasonId })
          .returning({ id: schema.teams.id });
        teamId = created.id;
        teamCreated = true;
      }

      const existingRosters = teamCreated
        ? []
        : await tx
            .select({ name: schema.rosters.name, division: schema.rosters.division })
            .from(schema.rosters)
            .where(eq(schema.rosters.teamId, teamId));

      const toCreate = planSchoolRosters(season.gameSlug, existingRosters);
      if (toCreate.length > 0) {
        await tx
          .insert(schema.rosters)
          .values(toCreate.map((r) => ({ teamId: teamId as string, name: r.name, division: r.division })));
      }

      return {
        success: true as const,
        schoolName: school.name,
        teamCreated,
        restored,
        rostersCreated: toCreate.map((r) => r.name),
      };
    });

    if (result.success && (result.teamCreated || result.restored || result.rostersCreated.length > 0)) {
      refreshSeasonSchools(seasonId, result.restored);
    }
    return result;
  } catch (error) {
    console.error(error);
    const unique = dbErrorChain(error).some((e) => (e as { code?: unknown }).code === '23505');
    return {
      success: false,
      error: unique
        ? 'Someone else just changed this school. Refresh the page and check its rosters.'
        : 'Could not add the school to this season.',
    };
  }
}
