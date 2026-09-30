'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath, updateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';
import {
  getSeasonStandingsForEditor,
  createSeasonStandingInDb,
  updateSeasonStandingInDb,
  deleteSeasonStandingInDb,
  deleteDivisionStandingsInDb,
  updateSeasonStandingsFormatInDb,
} from '@/app/lib/db/queries';

function revalidateStandings() {
  updateTag('rosters');
  updateTag('teams');
  updateTag('matches');
  revalidatePath('/admin/standings');
  revalidatePath('/');
}

async function requireMatchesPermission() {
  return requirePermission(Permissions.MANAGE_MATCHES);
}

const intOrNull = (v: FormDataEntryValue | null) => {
  const s = (v as string | null)?.trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
};

/** Win % arrives as 0-100 from the form; stored as 0-1. */
const pctOrNull = (v: FormDataEntryValue | null) => {
  const s = (v as string | null)?.trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.min(Math.max(n, 0), 100) / 100;
};

const floatOrNull = (v: FormDataEntryValue | null) => {
  const s = (v as string | null)?.trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

const textOrNull = (v: FormDataEntryValue | null) => {
  const s = (v as string | null)?.trim();
  return s || null;
};

function standingValues(formData: FormData) {
  return {
    division: (formData.get('division') as string) || 'Varsity',
    rank: intOrNull(formData.get('rank')),
    wins: intOrNull(formData.get('wins')),
    losses: intOrNull(formData.get('losses')),
    gamesPlayed: intOrNull(formData.get('gamesPlayed')),
    winPct: pctOrNull(formData.get('winPct')),
    points: floatOrNull(formData.get('points')),
    playerName: textOrNull(formData.get('playerName')),
    playerIgn: textOrNull(formData.get('playerIgn')),
    notes: textOrNull(formData.get('notes')),
  };
}

/** All snapshot rows of one season with school names, for the editor. */
export async function listSeasonStandings(seasonId: string) {
  await requireMatchesPermission();
  return getSeasonStandingsForEditor(seasonId);
}

export async function createStanding(formData: FormData) {
  await requireMatchesPermission();
  try {
    const seasonId = formData.get('seasonId') as string;
    const schoolId = formData.get('schoolId') as string;
    if (!seasonId || !schoolId) {
      return { success: false, error: 'Season and school are required.' };
    }
    const standing = await createSeasonStandingInDb({
      seasonId,
      schoolId,
      ...standingValues(formData),
    });
    revalidateStandings();
    return { success: true, standing };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateStanding(id: string, formData: FormData) {
  await requireMatchesPermission();
  try {
    const standing = await updateSeasonStandingInDb(id, standingValues(formData));
    revalidateStandings();
    return { success: true, standing };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteStanding(id: string) {
  await requireMatchesPermission();
  try {
    await deleteSeasonStandingInDb(id);
    revalidateStandings();
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

/** Convenience: delete every row of a season+division in one shot. */
export async function deleteDivisionStandings(seasonId: string, division: string) {
  await requireMatchesPermission();
  try {
    await deleteDivisionStandingsInDb(seasonId, division);
    revalidateStandings();
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateSeasonStandingsFormat(seasonId: string, format: 'divided' | 'combined') {
  await requireMatchesPermission();
  try {
    if (format !== 'divided' && format !== 'combined') {
      return { success: false, error: 'Invalid standings format. Must be divided or combined.' };
    }
    await updateSeasonStandingsFormatInDb(seasonId, format);
    revalidatePath('/admin/standings');
    revalidatePath('/admin/league');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}
