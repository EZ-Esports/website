'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';

async function requireAdmin() {
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
  await requireAdmin();
  return db
    .select({
      id: schema.seasonStandings.id,
      seasonId: schema.seasonStandings.seasonId,
      schoolId: schema.seasonStandings.schoolId,
      schoolName: schema.schools.name,
      division: schema.seasonStandings.division,
      rank: schema.seasonStandings.rank,
      wins: schema.seasonStandings.wins,
      losses: schema.seasonStandings.losses,
      gamesPlayed: schema.seasonStandings.gamesPlayed,
      winPct: schema.seasonStandings.winPct,
      points: schema.seasonStandings.points,
      playerName: schema.seasonStandings.playerName,
      playerIgn: schema.seasonStandings.playerIgn,
      notes: schema.seasonStandings.notes,
    })
    .from(schema.seasonStandings)
    .innerJoin(schema.schools, eq(schema.seasonStandings.schoolId, schema.schools.id))
    .where(eq(schema.seasonStandings.seasonId, seasonId))
    .orderBy(
      asc(schema.seasonStandings.division),
      sql`${schema.seasonStandings.rank} asc nulls last`,
      asc(schema.schools.name)
    );
}

export async function createStanding(formData: FormData) {
  await requireAdmin();
  try {
    const seasonId = formData.get('seasonId') as string;
    const schoolId = formData.get('schoolId') as string;
    if (!seasonId || !schoolId) {
      return { success: false, error: 'Season and school are required.' };
    }
    const res = await db
      .insert(schema.seasonStandings)
      .values({ seasonId, schoolId, ...standingValues(formData) })
      .returning();
    revalidatePath('/admin/standings');
    return { success: true, standing: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateStanding(id: string, formData: FormData) {
  await requireAdmin();
  try {
    const res = await db
      .update(schema.seasonStandings)
      .set(standingValues(formData))
      .where(eq(schema.seasonStandings.id, id))
      .returning();
    revalidatePath('/admin/standings');
    return { success: true, standing: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteStanding(id: string) {
  await requireAdmin();
  try {
    await db.delete(schema.seasonStandings).where(eq(schema.seasonStandings.id, id));
    revalidatePath('/admin/standings');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

/** Convenience: delete every row of a season+division in one shot. */
export async function deleteDivisionStandings(seasonId: string, division: string) {
  await requireAdmin();
  try {
    await db
      .delete(schema.seasonStandings)
      .where(
        and(
          eq(schema.seasonStandings.seasonId, seasonId),
          eq(schema.seasonStandings.division, division)
        )
      );
    revalidatePath('/admin/standings');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}
