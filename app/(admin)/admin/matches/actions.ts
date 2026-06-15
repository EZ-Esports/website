'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export type MatchActionResult = { success: boolean; error?: string };

export async function createMatch(formData: FormData): Promise<MatchActionResult> {
  await requireUser();
  const seasonId = formData.get('seasonId') as string;
  const homeRosterId = formData.get('homeRosterId') as string;
  const awayRosterId = formData.get('awayRosterId') as string;
  const scheduledAtStr = formData.get('scheduledAt') as string;

  if (!seasonId || !homeRosterId || !awayRosterId || !scheduledAtStr) {
    return { success: false, error: 'All fields are required.' };
  }

  if (homeRosterId === awayRosterId) {
    return { success: false, error: 'A roster cannot be scheduled to play against itself.' };
  }

  try {
    // Both rosters must belong to teams registered in the selected season (and the
    // same game) — guard against stale/crafted submits that would corrupt standings.
    const rosterTeams = await db
      .select({
        rosterId: schema.rosters.id,
        seasonId: schema.teams.seasonId,
        gameId: schema.teams.gameId,
      })
      .from(schema.rosters)
      .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
      .where(inArray(schema.rosters.id, [homeRosterId, awayRosterId]));

    if (rosterTeams.length !== 2) {
      return { success: false, error: 'Both rosters must exist and belong to a registered team.' };
    }
    if (!rosterTeams.every((r) => r.seasonId === seasonId)) {
      return { success: false, error: 'Both rosters must belong to teams in the selected season.' };
    }
    if (rosterTeams[0].gameId !== rosterTeams[1].gameId) {
      return { success: false, error: 'Both rosters must be from the same game.' };
    }

    await db.insert(schema.matches).values({
      seasonId,
      homeRosterId,
      awayRosterId,
      scheduledAt: new Date(scheduledAtStr),
      status: 'scheduled',
    });
  } catch (error) {
    console.error('Failed to create match', error);
    return { success: false, error: 'Could not schedule match. Please try again.' };
  }

  revalidateTag('matches', {});
  revalidatePath('/admin/matches');
  revalidatePath('/');
  return { success: true };
}

export async function updateMatchScore(id: string, formData: FormData): Promise<MatchActionResult> {
  await requireUser();
  const homeScoreStr = formData.get('homeScore') as string;
  const awayScoreStr = formData.get('awayScore') as string;
  const status = formData.get('status') as 'scheduled' | 'live' | 'completed' | 'forfeit' | 'cancelled';

  if (!status) {
    return { success: false, error: 'Status is required.' };
  }

  const homeScore = homeScoreStr ? parseInt(homeScoreStr, 10) : null;
  const awayScore = awayScoreStr ? parseInt(awayScoreStr, 10) : null;

  // A completed/forfeit result must record both scores, otherwise it contributes
  // nothing to standings and silently looks "done" without a recorded outcome.
  if ((status === 'completed' || status === 'forfeit') && (homeScore === null || awayScore === null)) {
    return { success: false, error: 'Enter both scores before marking a match completed or forfeit.' };
  }
  if ((homeScore !== null && homeScore < 0) || (awayScore !== null && awayScore < 0)) {
    return { success: false, error: 'Scores cannot be negative.' };
  }

  try {
    await db
      .update(schema.matches)
      .set({
        homeScore,
        awayScore,
        status,
      })
      .where(eq(schema.matches.id, id));
  } catch (error) {
    console.error('Failed to update match', error);
    return { success: false, error: 'Could not save match. Please try again.' };
  }

  revalidateTag('matches', {});
  revalidateTag('rosters', {});
  revalidatePath('/admin/matches');
  revalidatePath('/');
  return { success: true };
}

export async function deleteMatch(id: string) {
  await requireUser();
  await db.delete(schema.matches).where(eq(schema.matches.id, id));

  revalidateTag('matches', {});
  revalidateTag('rosters', {});
  revalidatePath('/admin/matches');
  revalidatePath('/');
}
