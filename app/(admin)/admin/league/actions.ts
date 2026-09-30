'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath, updateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';
import {
  createGameInDb,
  updateGameInDb,
  deleteGameInDb,
  createSeasonInDb,
  updateSeasonInDb,
  deleteSeasonInDb,
} from '@/app/lib/db/queries';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function revalidateLeague() {
  updateTag('games');
  updateTag('seasons');
  updateTag('teams');
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
    const game = await createGameInDb({ displayName, shortName, slug, imageUrl });

    revalidateLeague();
    return { success: true, game };
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

    const game = await updateGameInDb(id, { displayName, shortName, imageUrl });

    revalidateLeague();
    return { success: true, game };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteGame(id: string) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    await deleteGameInDb(id);
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
    const standingsFormatRaw = (formData.get('standingsFormat') as string)?.trim();
    const standingsFormat = standingsFormatRaw === 'combined' ? 'combined' : 'divided';

    if (!gameId || !name) {
      return { success: false, error: 'Game and season name are required.' };
    }

    const season = await createSeasonInDb({ gameId, name, isActive, standingsFormat });

    revalidateLeague();
    return { success: true, season };
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
    const standingsFormatRaw = (formData.get('standingsFormat') as string)?.trim();
    const standingsFormat = standingsFormatRaw ? (standingsFormatRaw === 'combined' ? 'combined' : 'divided') : undefined;

    if (!name) {
      return { success: false, error: 'Season name is required.' };
    }

    const season = await updateSeasonInDb(id, { name, isActive, standingsFormat });

    revalidateLeague();
    return { success: true, season };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteSeason(id: string) {
  await requirePermission(Permissions.MANAGE_LEAGUE);
  try {
    await deleteSeasonInDb(id);
    revalidateLeague();
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}
