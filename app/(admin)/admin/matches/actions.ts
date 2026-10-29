'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { parseEastern } from '@/app/lib/dates';
import { sameRosterDivision } from '@/app/lib/admin-match-list';

export type MatchActionResult = { success: boolean; error?: string };

function revalidateMatches() {
  updateTag('matches');
  updateTag('rosters');
  updateTag('teams');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function createMatch(formData: FormData): Promise<MatchActionResult> {
  await requirePermission(Permissions.MANAGE_MATCHES);
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
        division: schema.rosters.division,
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
    // Validated here, not only in the form: a crafted submit must not pair Varsity with JV.
    if (!sameRosterDivision(rosterTeams[0].division, rosterTeams[1].division)) {
      return { success: false, error: 'Both rosters must be in the same division.' };
    }

    const scheduledAt = parseEastern(scheduledAtStr);
    if (Number.isNaN(scheduledAt.getTime())) {
      return { success: false, error: 'Invalid scheduled date and time.' };
    }

    await db.insert(schema.matches).values({
      seasonId,
      homeRosterId,
      awayRosterId,
      scheduledAt,
      status: 'scheduled',
    });
  } catch (error) {
    console.error('Failed to create match', error);
    return { success: false, error: 'Could not schedule match. Please try again.' };
  }

  revalidateMatches();
  return { success: true };
}

export async function updateMatchScore(id: string, formData: FormData): Promise<MatchActionResult> {
  await requirePermission(Permissions.MANAGE_MATCHES);
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

  revalidateMatches();
  return { success: true };
}

export async function deleteMatch(id: string) {
  await requirePermission(Permissions.MANAGE_MATCHES);
  await db.delete(schema.matches).where(eq(schema.matches.id, id));

  revalidateMatches();
}

/** Upper bound for one bulk delete; the explorer pages 25 at a time, so this is generous. */
const MAX_BULK_DELETE_MATCHES = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeleteMatchesResult = { success: boolean; error?: string; deleted?: number };

/**
 * Deletes several matches at once. Same permission and cascade behaviour as
 * deleteMatch (results, game data and reschedule requests go with each match via
 * foreign keys), but all-or-nothing: ids are validated server-side and the delete
 * runs in one transaction.
 */
export async function deleteMatches(ids: string[]): Promise<DeleteMatchesResult> {
  await requirePermission(Permissions.MANAGE_MATCHES);

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Select at least one match to delete.' };
  }
  if (!ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
    return { success: false, error: 'One or more selected matches are invalid.' };
  }
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
  if (unique.length > MAX_BULK_DELETE_MATCHES) {
    return { success: false, error: `You can delete at most ${MAX_BULK_DELETE_MATCHES} matches at once.` };
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(schema.matches)
        .where(inArray(schema.matches.id, unique))
        .returning({ id: schema.matches.id });
      return rows.length;
    });
    revalidateMatches();
    return { success: true, deleted };
  } catch (error) {
    console.error('Failed to delete matches', error);
    return { success: false, error: 'Could not delete the selected matches. Please try again.' };
  }
}
