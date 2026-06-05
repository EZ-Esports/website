'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

// Helper to dynamically recalculate team wins and losses based on completed matches
async function recalculateTeamStandings(teamId: string) {
  const homeMatches = await db
    .select()
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.homeTeamId, teamId),
        eq(schema.matches.status, 'completed')
      )
    );

  const awayMatches = await db
    .select()
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.awayTeamId, teamId),
        eq(schema.matches.status, 'completed')
      )
    );

  let wins = 0;
  let losses = 0;

  for (const m of homeMatches) {
    if (m.homeScore !== null && m.awayScore !== null) {
      if (m.homeScore > m.awayScore) {
        wins++;
      } else if (m.homeScore < m.awayScore) {
        losses++;
      }
    }
  }

  for (const m of awayMatches) {
    if (m.homeScore !== null && m.awayScore !== null) {
      if (m.awayScore > m.homeScore) {
        wins++;
      } else if (m.awayScore < m.homeScore) {
        losses++;
      }
    }
  }

  await db
    .update(schema.teams)
    .set({ wins, losses })
    .where(eq(schema.teams.id, teamId));
}

export async function createMatch(formData: FormData) {
  const seasonId = formData.get('seasonId') as string;
  const homeTeamId = formData.get('homeTeamId') as string;
  const awayTeamId = formData.get('awayTeamId') as string;
  const scheduledAtStr = formData.get('scheduledAt') as string;

  if (!seasonId || !homeTeamId || !awayTeamId || !scheduledAtStr) {
    throw new Error('All fields are required.');
  }

  await db.insert(schema.matches).values({
    seasonId,
    homeTeamId,
    awayTeamId,
    scheduledAt: new Date(scheduledAtStr),
    status: 'scheduled',
  });

  revalidateTag('matches', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function updateMatchScore(id: string, formData: FormData) {
  const homeScoreStr = formData.get('homeScore') as string;
  const awayScoreStr = formData.get('awayScore') as string;
  const status = formData.get('status') as string;

  if (!status) {
    throw new Error('Status is required.');
  }

  const homeScore = homeScoreStr ? parseInt(homeScoreStr, 10) : null;
  const awayScore = awayScoreStr ? parseInt(awayScoreStr, 10) : null;

  // Retrieve current match info
  const currentMatches = await db.select().from(schema.matches).where(eq(schema.matches.id, id)).limit(1);
  const currentMatch = currentMatches[0];

  if (!currentMatch) {
    throw new Error('Match not found.');
  }

  // Update match record
  await db
    .update(schema.matches)
    .set({
      homeScore,
      awayScore,
      status,
    })
    .where(eq(schema.matches.id, id));

  // Recalculate standings for both teams involved
  await recalculateTeamStandings(currentMatch.homeTeamId);
  await recalculateTeamStandings(currentMatch.awayTeamId);

  revalidateTag('matches', 'max');
  revalidateTag('teams', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function deleteMatch(id: string) {
  // Retrieve current match info before deleting to know which teams to recalculate
  const currentMatches = await db.select().from(schema.matches).where(eq(schema.matches.id, id)).limit(1);
  const currentMatch = currentMatches[0];

  await db.delete(schema.matches).where(eq(schema.matches.id, id));

  if (currentMatch) {
    await recalculateTeamStandings(currentMatch.homeTeamId);
    await recalculateTeamStandings(currentMatch.awayTeamId);
  }

  revalidateTag('matches', 'max');
  revalidateTag('teams', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}
