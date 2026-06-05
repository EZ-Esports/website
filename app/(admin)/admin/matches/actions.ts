'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createMatch(formData: FormData) {
  const seasonId = formData.get('seasonId') as string;
  const homeRosterId = formData.get('homeRosterId') as string;
  const awayRosterId = formData.get('awayRosterId') as string;
  const scheduledAtStr = formData.get('scheduledAt') as string;

  if (!seasonId || !homeRosterId || !awayRosterId || !scheduledAtStr) {
    throw new Error('All fields are required.');
  }

  if (homeRosterId === awayRosterId) {
    throw new Error('A roster cannot be scheduled to play against itself.');
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
  const status = formData.get('status') as any;

  if (!status) {
    throw new Error('Status is required.');
  }

  const homeScore = homeScoreStr ? parseInt(homeScoreStr, 10) : null;
  const awayScore = awayScoreStr ? parseInt(awayScoreStr, 10) : null;

  // Update match record
  await db
    .update(schema.matches)
    .set({
      homeScore,
      awayScore,
      status,
    })
    .where(eq(schema.matches.id, id));

  revalidateTag('matches', 'max');
  revalidateTag('rosters', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function deleteMatch(id: string) {
  await db.delete(schema.matches).where(eq(schema.matches.id, id));

  revalidateTag('matches', 'max');
  revalidateTag('rosters', 'max');
  revalidatePath('/admin/matches');
  revalidatePath('/');
}
