'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

// Helper to dynamically recalculate team roster wins and losses based on completed matches
async function recalculateRosterStandings(rosterId: string) {
  const homeMatches = await db
    .select()
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.homeRosterId, rosterId),
        eq(schema.matches.status, 'completed')
      )
    );

  const awayMatches = await db
    .select()
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.awayRosterId, rosterId),
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
    .update(schema.rosters)
    .set({ wins, losses })
    .where(eq(schema.rosters.id, rosterId));
}

export async function createMatch(formData: FormData) {
  const seasonId = formData.get('seasonId') as string;
  const homeRosterId = formData.get('homeRosterId') as string;
  const awayRosterId = formData.get('awayRosterId') as string;
  const scheduledAtStr = formData.get('scheduledAt') as string;

  if (!seasonId || !homeRosterId || !awayRosterId || !scheduledAtStr) {
    throw new Error('All fields are required.');
  }

  await db.insert(schema.matches).values({
    seasonId,
    homeRosterId,
    awayRosterId,
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

  // Recalculate standings for both rosters involved
  await recalculateRosterStandings(currentMatch.homeRosterId);
  await recalculateRosterStandings(currentMatch.awayRosterId);

  revalidateTag('matches', 'max');
  revalidateTag('rosters', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function deleteMatch(id: string) {
  // Retrieve current match info before deleting to know which rosters to recalculate
  const currentMatches = await db.select().from(schema.matches).where(eq(schema.matches.id, id)).limit(1);
  const currentMatch = currentMatches[0];

  await db.delete(schema.matches).where(eq(schema.matches.id, id));

  if (currentMatch) {
    await recalculateRosterStandings(currentMatch.homeRosterId);
    await recalculateRosterStandings(currentMatch.awayRosterId);
  }

  revalidateTag('matches', 'max');
  revalidateTag('rosters', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}
