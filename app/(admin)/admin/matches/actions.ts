'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

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

  // If status is transitioning to completed for the first time, update standings
  if (status === 'completed' && currentMatch.status !== 'completed' && homeScore !== null && awayScore !== null) {
    const homeWin = homeScore > awayScore;
    const awayWin = awayScore > homeScore;

    // Increment home team
    const homeTeams = await db.select().from(schema.teams).where(eq(schema.teams.id, currentMatch.homeTeamId)).limit(1);
    if (homeTeams[0]) {
      await db
        .update(schema.teams)
        .set({
          wins: homeTeams[0].wins + (homeWin ? 1 : 0),
          losses: homeTeams[0].losses + (awayWin ? 1 : 0),
        })
        .where(eq(schema.teams.id, currentMatch.homeTeamId));
    }

    // Increment away team
    const awayTeams = await db.select().from(schema.teams).where(eq(schema.teams.id, currentMatch.awayTeamId)).limit(1);
    if (awayTeams[0]) {
      await db
        .update(schema.teams)
        .set({
          wins: awayTeams[0].wins + (awayWin ? 1 : 0),
          losses: awayTeams[0].losses + (homeWin ? 1 : 0),
        })
        .where(eq(schema.teams.id, currentMatch.awayTeamId));
    }
  }

  revalidateTag('matches', 'max');
  revalidateTag('teams', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function deleteMatch(id: string) {
  await db.delete(schema.matches).where(eq(schema.matches.id, id));
  revalidateTag('matches', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}
