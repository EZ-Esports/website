'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createRosterMember(formData: FormData) {
  const rosterId = formData.get('rosterId') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const bio = formData.get('bio') as string;

  if (!rosterId || !name || !role) {
    throw new Error('Roster, Name, and Role are required.');
  }

  await db.insert(schema.players).values({
    rosterId,
    name,
    role,
    bio,
  });

  revalidateTag('players', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function deleteRosterMember(id: string) {
  await db.delete(schema.players).where(eq(schema.players.id, id));
  revalidateTag('players', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function createTeam(formData: FormData) {
  const gameId = formData.get('gameId') as string;
  const name = formData.get('name') as string;

  if (!gameId || !name) {
    throw new Error('Game and Team Name are required.');
  }

  await db.insert(schema.teams).values({
    gameId,
    name,
  });

  revalidateTag('teams', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function deleteTeam(id: string) {
  await db.delete(schema.teams).where(eq(schema.teams.id, id));
  revalidateTag('teams', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function createRoster(formData: FormData) {
  const teamId = formData.get('teamId') as string;
  const name = formData.get('name') as string;
  const division = formData.get('division') as string;
  const winsStr = formData.get('wins') as string;
  const lossesStr = formData.get('losses') as string;

  if (!teamId || !name || !division) {
    throw new Error('Team, Roster Name, and Division are required.');
  }

  const wins = winsStr ? parseInt(winsStr, 10) : 0;
  const losses = lossesStr ? parseInt(lossesStr, 10) : 0;

  await db.insert(schema.rosters).values({
    teamId,
    name,
    division,
    wins,
    losses,
  });

  revalidateTag('rosters', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function deleteRoster(id: string) {
  await db.delete(schema.rosters).where(eq(schema.rosters.id, id));
  revalidateTag('rosters', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function updateRosterRecord(id: string, formData: FormData) {
  const winsStr = formData.get('wins') as string;
  const lossesStr = formData.get('losses') as string;

  const wins = winsStr ? parseInt(winsStr, 10) : 0;
  const losses = lossesStr ? parseInt(lossesStr, 10) : 0;

  await db
    .update(schema.rosters)
    .set({ wins, losses })
    .where(eq(schema.rosters.id, id));

  revalidateTag('rosters', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}
