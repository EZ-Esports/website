'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createMatch(formData: FormData) {
  await requireUser();
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

  revalidateTag('matches', {});
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function updateMatchScore(id: string, formData: FormData) {
  await requireUser();
  const homeScoreStr = formData.get('homeScore') as string;
  const awayScoreStr = formData.get('awayScore') as string;
  const status = formData.get('status') as 'scheduled' | 'live' | 'completed' | 'forfeit' | 'cancelled';

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

  revalidateTag('matches', {});
  revalidateTag('rosters', {});
  revalidatePath('/admin/matches');
  revalidatePath('/');
}

export async function deleteMatch(id: string) {
  await requireUser();
  await db.delete(schema.matches).where(eq(schema.matches.id, id));

  revalidateTag('matches', {});
  revalidateTag('rosters', {});
  revalidatePath('/admin/matches');
  revalidatePath('/');
}
