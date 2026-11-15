'use server';

import { z } from 'zod';
import { and, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
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
  | {
      success: true;
      schoolName: string;
      /** A new membership row was written. */
      teamCreated: boolean;
      /** The school already had rosters for this season (it was removed earlier) and they are back. */
      restored: boolean;
      rostersCreated: string[];
    }
  | { success: false; error: string };

export type RemoveSchoolFromSeasonResult =
  | { success: true; schoolName: string; alreadyRemoved: boolean; hiddenMatches: number }
  | { success: false; error: string };

/**
 * Caches and pages that show a season's schools. Membership decides what the public sees (team
 * lists, schedule, standings, hub, archive), so the public pages are refreshed too.
 */
function refreshSeasonSchools(seasonId: string) {
  updateTag('teams');
  updateTag('rosters');
  updateTag('matches');
  revalidatePath(`/admin/league/${seasonId}`, 'layout');
  revalidatePath('/admin/schools', 'layout');
  revalidatePath('/admin/matches');
  revalidatePath('/portal');
  revalidatePath('/');
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

/**
 * Puts a school in a game's season (spec-060). Membership is one `season_schools` row; the school's
 * rosters belong to the school and season themselves. So this finds or creates the membership row and
 * then creates ONLY the rosters the game fields that the school does not already have for the season:
 * a school that was removed earlier comes back with its existing rosters, players and matches, and
 * calling it twice (or racing two staff, which the per-(season, school) advisory lock serializes)
 * never duplicates anything. Staff only; the manager roster lock does not apply (spec-020).
 */
export async function addSchoolToSeason(input: { seasonId: string; schoolId: string }): Promise<AddSchoolToSeasonResult> {
  const actor = await requirePermission(Permissions.MANAGE_LEAGUE);

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

      // Serializes two staff adding or removing the same school at once; the unique indexes stay the backstop.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`season-school:${seasonId}:${schoolId}`}))`);

      const [membership] = await tx
        .select({ id: schema.seasonSchools.id })
        .from(schema.seasonSchools)
        .where(
          and(
            eq(schema.seasonSchools.schoolId, schoolId),
            eq(schema.seasonSchools.gameId, season.gameId),
            eq(schema.seasonSchools.seasonId, seasonId),
          ),
        )
        .limit(1);

      let teamCreated = false;
      if (!membership) {
        await tx.insert(schema.seasonSchools).values({ schoolId, gameId: season.gameId, seasonId });
        teamCreated = true;
      }

      // What the school already has for this game and season, whether or not it is a member right now.
      const existingRosters = await tx
        .select({ name: schema.rosters.name, division: schema.rosters.division })
        .from(schema.rosters)
        .where(
          and(
            eq(schema.rosters.schoolId, schoolId),
            eq(schema.rosters.gameId, season.gameId),
            eq(schema.rosters.seasonId, seasonId),
          ),
        );

      const toCreate = planSchoolRosters(season.gameSlug, existingRosters);
      if (toCreate.length > 0) {
        await tx.insert(schema.rosters).values(
          toCreate.map((r) => ({
            schoolId,
            gameId: season.gameId,
            seasonId,
            name: r.name,
            division: r.division,
          })),
        );
      }

      const restored = teamCreated && existingRosters.length > 0;
      if (restored) {
        await tx.insert(schema.staffAuditLogs).values({
          event: 'restore_school_to_season',
          userId: actor.id,
          email: actor.email,
          details: JSON.stringify({ seasonId, schoolId, schoolName: school.name, existingRosters: existingRosters.length }),
        });
      }

      return {
        success: true as const,
        schoolName: school.name,
        teamCreated,
        restored,
        rostersCreated: toCreate.map((r) => r.name),
      };
    });

    if (result.success && (result.teamCreated || result.rostersCreated.length > 0)) {
      refreshSeasonSchools(seasonId);
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

/**
 * Takes a school out of one game's season by deleting ONLY its membership row. Rosters, players and
 * matches belong to the school and season themselves and are not touched (nothing cascades from the
 * membership row), so adding the school back restores everything. Public pages stop showing the
 * school and any match it is in (both sides must be members); staff views still see it all. Repeating
 * it is a no-op. Audited.
 */
export async function removeSchoolFromSeason(input: { seasonId: string; schoolId: string }): Promise<RemoveSchoolFromSeasonResult> {
  const actor = await requirePermission(Permissions.MANAGE_LEAGUE);

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Choose a school to remove.' };
  const { seasonId, schoolId } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`season-school:${seasonId}:${schoolId}`}))`);

      const [school] = await tx
        .select({ name: schema.schools.name })
        .from(schema.schools)
        .where(eq(schema.schools.id, schoolId))
        .limit(1);
      if (!school) return { success: false as const, error: 'School not found.' };

      const removed = await tx
        .delete(schema.seasonSchools)
        .where(and(eq(schema.seasonSchools.schoolId, schoolId), eq(schema.seasonSchools.seasonId, seasonId)))
        .returning({ id: schema.seasonSchools.id });

      // Matches the school's rosters play in this season: now hidden from the public, kept in the database.
      const rosterIds = (
        await tx
          .select({ id: schema.rosters.id })
          .from(schema.rosters)
          .where(and(eq(schema.rosters.schoolId, schoolId), eq(schema.rosters.seasonId, seasonId)))
      ).map((r) => r.id);
      const [{ value: hiddenMatches }] = rosterIds.length
        ? await tx
            .select({ value: count() })
            .from(schema.matches)
            .where(or(inArray(schema.matches.homeRosterId, rosterIds), inArray(schema.matches.awayRosterId, rosterIds)))
        : [{ value: 0 }];

      if (removed.length === 0) {
        return { success: true as const, schoolName: school.name, alreadyRemoved: true, hiddenMatches };
      }

      await tx.insert(schema.staffAuditLogs).values({
        event: 'remove_school_from_season',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({ seasonId, schoolId, schoolName: school.name, rosters: rosterIds.length, hiddenMatches }),
      });
      return { success: true as const, schoolName: school.name, alreadyRemoved: false, hiddenMatches };
    });

    if (result.success && !result.alreadyRemoved) refreshSeasonSchools(seasonId);
    return result;
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Could not remove the school from this season.' };
  }
}
