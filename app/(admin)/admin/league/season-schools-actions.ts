'use server';

import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
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
  | { success: true; schoolName: string; teamCreated: boolean; rostersCreated: string[] }
  | { success: false; error: string };

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
        .select({ id: schema.teams.id })
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
          .values(
            toCreate.map((r) => ({
              teamId: teamId as string,
              schoolId,
              gameId: season.gameId,
              seasonId,
              name: r.name,
              division: r.division,
            })),
          );
      }

      return {
        success: true as const,
        schoolName: school.name,
        teamCreated,
        rostersCreated: toCreate.map((r) => r.name),
      };
    });

    if (result.success && (result.teamCreated || result.rostersCreated.length > 0)) {
      updateTag('teams');
      updateTag('rosters');
      revalidatePath(`/admin/league/${seasonId}`);
      revalidatePath('/admin/schools', 'layout');
      revalidatePath('/admin/matches');
      revalidatePath('/portal');
      revalidatePath('/');
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
