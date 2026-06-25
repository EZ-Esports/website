'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function revalidateLeague() {
  revalidateTag('games', {});
  revalidateTag('seasons', {});
  revalidatePath('/admin/league');
  revalidatePath('/admin/matches');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

// --- GAME ACTIONS ---

export async function createGame(formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    const displayName = (formData.get('displayName') as string)?.trim();
    const shortName = (formData.get('shortName') as string)?.trim();
    const imageUrl = (formData.get('imageUrl') as string) || null;

    if (!displayName || !shortName) {
      return { success: false, error: 'Display name and short name are required.' };
    }

    const slug = slugify(displayName);
    const res = await db
      .insert(schema.games)
      .values({ displayName, shortName, slug, imageUrl })
      .returning();

    revalidateLeague();
    return { success: true, game: res[0] };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateGame(id: string, formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    const displayName = (formData.get('displayName') as string)?.trim();
    const shortName = (formData.get('shortName') as string)?.trim();
    const imageUrl = (formData.get('imageUrl') as string) || null;

    if (!displayName || !shortName) {
      return { success: false, error: 'Display name and short name are required.' };
    }

    const res = await db
      .update(schema.games)
      .set({ displayName, shortName, imageUrl })
      .where(eq(schema.games.id, id))
      .returning();

    revalidateLeague();
    return { success: true, game: res[0] };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteGame(id: string) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    await db.delete(schema.games).where(eq(schema.games.id, id));
    revalidateLeague();
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Cannot delete game — it may have active seasons or teams linked to it.' };
  }
}

// --- SEASON ACTIONS ---

export async function createSeason(formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    const gameId = (formData.get('gameId') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const isActive = formData.get('isActive') === 'true';

    if (!gameId || !name) {
      return { success: false, error: 'Game and season name are required.' };
    }

    const res = await db
      .insert(schema.seasons)
      .values({ gameId, name, isActive })
      .returning();

    revalidateLeague();
    return { success: true, season: res[0] };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateSeason(id: string, formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    const name = (formData.get('name') as string)?.trim();
    const isActive = formData.get('isActive') === 'true';

    if (!name) {
      return { success: false, error: 'Season name is required.' };
    }

    const res = await db
      .update(schema.seasons)
      .set({ name, isActive })
      .where(eq(schema.seasons.id, id))
      .returning();

    revalidateLeague();
    return { success: true, season: res[0] };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteSeason(id: string) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    await db.delete(schema.seasons).where(eq(schema.seasons.id, id));
    revalidateLeague();
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Cannot delete season — it may have active teams or matches linked to it.' };
  }
}
