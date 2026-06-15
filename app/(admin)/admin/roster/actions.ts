'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';

// Safe wrapper for cache revalidations to support testing/scripts outside Next.js runtime
function safeRevalidateTag(tag: string) {
  try {
    revalidateTag(tag, {});
  } catch {
    // Safely ignore when called outside Next.js server context (e.g. testing)
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Safely ignore when called outside Next.js server context (e.g. testing)
  }
}

// School CRUD lives in app/(admin)/admin/schools/actions.ts (the canonical editor).
// RosterExplorer links to /admin/schools for school management.

// --- MEMBER ACTIONS ---

export async function createMember(formData: FormData) {
  await requireUser();
  try {
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const schoolId = formData.get('schoolId') as string;
    const email = formData.get('email') as string;
    const discord = formData.get('discord') as string;
    const gradYear = formData.get('graduationYear') as string;

    if (!firstName || !lastName || !schoolId) {
      return { success: false, error: 'First Name, Last Name, and School are required.' };
    }

    const res = await db.insert(schema.members).values({
      firstName,
      lastName,
      schoolId,
      email: email || null,
      discord: discord || null,
      graduationYear: gradYear ? parseInt(gradYear, 10) : null,
    }).returning();

    safeRevalidateTag('members');
    safeRevalidatePath('/admin/roster');
    return { success: true, member: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateMember(id: string, formData: FormData) {
  await requireUser();
  try {
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const schoolId = formData.get('schoolId') as string;
    const email = formData.get('email') as string;
    const discord = formData.get('discord') as string;
    const gradYear = formData.get('graduationYear') as string;

    if (!firstName || !lastName || !schoolId) {
      return { success: false, error: 'First Name, Last Name, and School are required.' };
    }

    const res = await db.update(schema.members)
      .set({
        firstName,
        lastName,
        schoolId,
        email: email || null,
        discord: discord || null,
        graduationYear: gradYear ? parseInt(gradYear, 10) : null,
      })
      .where(eq(schema.members.id, id))
      .returning();

    safeRevalidateTag('members');
    safeRevalidatePath('/admin/roster');
    return { success: true, member: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteMember(id: string) {
  await requireUser();
  try {
    await db.delete(schema.members).where(eq(schema.members.id, id));
    safeRevalidateTag('members');
    safeRevalidatePath('/admin/roster');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return {
      success: false,
      error: 'Cannot delete member. Please make sure this member is removed from all rosters first.'
    };
  }
}

// --- TEAM ACTIONS ---

export async function createTeam(formData: FormData) {
  await requireUser();
  try {
    const schoolId = formData.get('schoolId') as string;
    const gameId = formData.get('gameId') as string;
    const seasonId = formData.get('seasonId') as string;

    if (!schoolId || !gameId || !seasonId) {
      return { success: false, error: 'School, Game, and Season are required.' };
    }

    // A season belongs to exactly one game — reject mismatched game/season pairs
    // so we never persist a team whose season is for a different game.
    const season = await db
      .select({ gameId: schema.seasons.gameId })
      .from(schema.seasons)
      .where(eq(schema.seasons.id, seasonId))
      .limit(1);

    if (!season[0]) {
      return { success: false, error: 'Selected season no longer exists.' };
    }
    if (season[0].gameId !== gameId) {
      return { success: false, error: 'That season belongs to a different game. Pick a season for the selected game.' };
    }

    const res = await db.insert(schema.teams).values({
      schoolId,
      gameId,
      seasonId,
    }).returning();

    safeRevalidateTag('teams');
    safeRevalidatePath('/admin/roster');
    return { success: true, team: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: 'Failed to register team. Note: A school can only have one team per game/season.' };
  }
}

export async function deleteTeam(id: string) {
  await requireUser();
  try {
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
    safeRevalidateTag('teams');
    safeRevalidateTag('rosters');
    safeRevalidateTag('players');
    safeRevalidatePath('/admin/roster');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

// --- ROSTER ACTIONS ---

export async function createRoster(formData: FormData) {
  await requireUser();
  try {
    const teamId = formData.get('teamId') as string;
    const name = formData.get('name') as string;
    const division = formData.get('division') as string;

    if (!teamId || !name || !division) {
      return { success: false, error: 'Team, Roster Name, and Division are required.' };
    }

    const res = await db.insert(schema.rosters).values({
      teamId,
      name,
      division,
    }).returning();

    safeRevalidateTag('rosters');
    safeRevalidatePath('/admin/roster');
    return { success: true, roster: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: 'Failed to create roster. Note: Roster names must be unique within a team.' };
  }
}

export async function updateRoster(id: string, formData: FormData) {
  await requireUser();
  try {
    const name = formData.get('name') as string;
    const division = formData.get('division') as string;

    if (!name || !division) {
      return { success: false, error: 'Roster name and division are required.' };
    }

    const res = await db.update(schema.rosters)
      .set({ name, division })
      .where(eq(schema.rosters.id, id))
      .returning();

    safeRevalidateTag('rosters');
    safeRevalidatePath('/admin/roster');
    return { success: true, roster: res[0] };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteRoster(id: string) {
  await requireUser();
  try {
    await db.delete(schema.rosters).where(eq(schema.rosters.id, id));
    safeRevalidateTag('rosters');
    safeRevalidateTag('players');
    safeRevalidatePath('/admin/roster');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

// --- PLAYER / ROSTER MEMBER ACTIONS ---

// The partial unique index players_roster_one_captain_idx allows only one captain
// per roster; translate its violation into actionable guidance.
function isCaptainConflict(error: unknown): boolean {
  const e = error as { constraint_name?: string; message?: string };
  return e?.constraint_name === 'players_roster_one_captain_idx'
    || (typeof e?.message === 'string' && e.message.includes('players_roster_one_captain_idx'));
}
const CAPTAIN_CONFLICT_MSG = 'This roster already has a captain. Demote the current captain before assigning a new one.';

export async function createRosterMember(formData: FormData) {
  await requireUser();
  try {
    const rosterId = formData.get('rosterId') as string;
    const memberId = formData.get('memberId') as string;
    const role = formData.get('role') as any;
    const ign = formData.get('ign') as string;
    const bio = formData.get('bio') as string;

    if (!rosterId || !memberId || !role) {
      return { success: false, error: 'Roster, Member, and Role are required.' };
    }

    const res = await db.insert(schema.players).values({
      rosterId,
      memberId,
      role,
      ign: ign || null,
      bio: bio || null,
      // Captain is a role, not a separate flag. Keep the boolean in sync so any
      // consumer reading isCaptain agrees with the displayed role.
      isCaptain: role === 'captain',
    }).returning();

    safeRevalidateTag('players');
    safeRevalidatePath('/admin/roster');
    return { success: true, player: res[0] };
  } catch (error: unknown) {
    console.error(error);
    if (isCaptainConflict(error)) return { success: false, error: CAPTAIN_CONFLICT_MSG };
    return { success: false, error: 'Failed to register player. Note: A member can only be registered once per roster.' };
  }
}

export async function updateRosterMember(id: string, formData: FormData) {
  await requireUser();
  try {
    const role = formData.get('role') as any;
    const ign = formData.get('ign') as string;
    const bio = formData.get('bio') as string;
    // Captaincy is derived from the role so the two never disagree.
    const isCaptain = role === 'captain';

    const res = await db
      .update(schema.players)
      .set({ role, ign: ign || null, bio: bio || null, isCaptain })
      .where(eq(schema.players.id, id))
      .returning();

    safeRevalidateTag('players');
    safeRevalidatePath('/admin/roster');
    return { success: true, player: res[0] };
  } catch (error: unknown) {
    console.error(error);
    if (isCaptainConflict(error)) return { success: false, error: CAPTAIN_CONFLICT_MSG };
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteRosterMember(id: string) {
  await requireUser();
  try {
    await db.delete(schema.players).where(eq(schema.players.id, id));
    safeRevalidateTag('players');
    safeRevalidatePath('/admin/roster');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}
