'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, count, eq, or, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { memberInSchool, playerInSchool, rosterInSchool, teamInSchool } from '@/app/lib/db/roster-scope';
import { allowedRosterDivisions, storedDivision } from '@/app/lib/school-roster-view';
import { toHubDivision, type CanonicalDivision } from '@/app/lib/db/match-page';

/**
 * Staff roster editing, scoped to one school (Schools & Rosters ->
 * /admin/schools/[schoolId]/rosters). Every action authorizes itself with
 * MANAGE_ROSTERS before touching anything, and every write that takes an id
 * resolves that id through `schoolId` (app/lib/db/roster-scope.ts) so a form
 * for one school cannot write another school's rows. Staff are exempt from the
 * manager roster lock (spec-020): there is deliberately no lock check here.
 */

async function requireRosterPermission() {
  return requirePermission(Permissions.MANAGE_ROSTERS);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = ['player', 'captain', 'coach', 'sub'] as const;
type Role = (typeof ROLES)[number];
const NOT_FOUND = { success: false as const, error: 'That record was not found for this school.' };
const BAD_SCHOOL = { success: false as const, error: 'Invalid school.' };

/** The school's roster page and the Schools list (which links to it) re-render after a write. */
function refreshSchoolRosters(schoolId: string) {
  revalidatePath(`/admin/schools/${schoolId}/rosters`);
  revalidatePath('/admin/schools');
}

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function parseRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

function parseGradYear(value: string): number | null | 'invalid' {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1990 && n <= 2100 ? n : 'invalid';
}

/** Explicit spellings only: an unknown string is rejected rather than quietly becoming Varsity. */
function parseDivision(value: string): CanonicalDivision | null {
  if (value === 'Varsity' || value === 'A') return 'Varsity';
  if (value === 'JV' || value === 'B') return 'JV';
  if (value === 'All') return 'All';
  return null;
}

// --- MEMBER ACTIONS ---

export async function createMember(schoolId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const firstName = text(formData, 'firstName');
    const lastName = text(formData, 'lastName');
    const discord = text(formData, 'discord');
    const gradYear = parseGradYear(text(formData, 'graduationYear'));

    if (!firstName || !lastName) return { success: false, error: 'First and last name are required.' };
    if (gradYear === 'invalid') return { success: false, error: 'Class year must be a four-digit year.' };

    const [member] = await db
      .insert(schema.members)
      .values({ firstName, lastName, schoolId, discord: discord || null, graduationYear: gradYear })
      .returning({ id: schema.members.id });

    updateTag('members');
    refreshSchoolRosters(schoolId);
    return { success: true, memberId: member.id };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

/** Edits name, Discord and class year only. Email and the school are never touched here. */
export async function updateMember(schoolId: string, memberId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const firstName = text(formData, 'firstName');
    const lastName = text(formData, 'lastName');
    const discord = text(formData, 'discord');
    const gradYear = parseGradYear(text(formData, 'graduationYear'));

    if (!firstName || !lastName) return { success: false, error: 'First and last name are required.' };
    if (gradYear === 'invalid') return { success: false, error: 'Class year must be a four-digit year.' };
    if (!(await memberInSchool(memberId, schoolId))) return NOT_FOUND;

    await db
      .update(schema.members)
      .set({ firstName, lastName, discord: discord || null, graduationYear: gradYear })
      .where(eq(schema.members.id, memberId));

    updateTag('members');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

// --- TEAM ACTIONS ---

export async function createTeam(schoolId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const gameId = text(formData, 'gameId');
    const seasonId = text(formData, 'seasonId');

    if (!gameId || !seasonId) return { success: false, error: 'Game and Season are required.' };

    // A season belongs to exactly one game: reject mismatched pairs so we never
    // persist a team whose season is for a different game.
    const season = await db
      .select({ gameId: schema.seasons.gameId })
      .from(schema.seasons)
      .where(eq(schema.seasons.id, seasonId))
      .limit(1);

    if (!season[0]) return { success: false, error: 'Selected season no longer exists.' };
    if (season[0].gameId !== gameId) {
      return { success: false, error: 'That season belongs to a different game. Pick a season for the selected game.' };
    }

    await db.insert(schema.teams).values({ schoolId, gameId, seasonId });

    updateTag('teams');
    refreshSchoolRosters(schoolId);
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: 'Failed to register team. Note: A school can only have one team per game/season.' };
  }
}

// --- ROSTER ACTIONS ---

export async function createRoster(schoolId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const teamId = text(formData, 'teamId');
    const name = text(formData, 'name');
    const division = parseDivision(text(formData, 'division'));

    if (!teamId || !name || !division) return { success: false, error: 'Team, Roster Name, and Division are required.' };

    const team = await teamInSchool(teamId, schoolId);
    if (!team) return NOT_FOUND;
    if (!allowedRosterDivisions(team.gameSlug).includes(division)) {
      return { success: false, error: `${division} is not a division for this game.` };
    }

    await db.insert(schema.rosters).values({ teamId, name, division: storedDivision(division) });

    updateTag('rosters');
    updateTag('teams');
    refreshSchoolRosters(schoolId);
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: 'Failed to create roster. Note: Roster names must be unique within a team.' };
  }
}

export async function updateRoster(schoolId: string, rosterId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const name = text(formData, 'name');
    const division = parseDivision(text(formData, 'division'));

    if (!name || !division) return { success: false, error: 'Roster name and division are required.' };

    const roster = await rosterInSchool(rosterId, schoolId);
    if (!roster) return NOT_FOUND;

    // Leave the stored spelling alone when the division did not change (A vs Varsity, All), so a
    // rename never rewrites it; a real change must be a division this game has.
    const unchanged =
      division === 'All' ? roster.division === 'All' : toHubDivision(roster.division) === division;
    if (!unchanged && !allowedRosterDivisions(roster.gameSlug).includes(division)) {
      return { success: false, error: `${division} is not a division for this game.` };
    }

    await db
      .update(schema.rosters)
      .set({ name, division: unchanged ? roster.division : storedDivision(division) })
      .where(eq(schema.rosters.id, rosterId));

    updateTag('rosters');
    updateTag('teams');
    refreshSchoolRosters(schoolId);
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteRoster(schoolId: string, rosterId: string) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    if (!(await rosterInSchool(rosterId, schoolId))) return NOT_FOUND;

    // matches.home_roster_id / away_roster_id are ON DELETE CASCADE: deleting a roster would
    // silently delete every match it played (scores, standings). Refuse instead.
    const [{ n: matchCount }] = await db
      .select({ n: count() })
      .from(schema.matches)
      .where(or(eq(schema.matches.homeRosterId, rosterId), eq(schema.matches.awayRosterId, rosterId)));
    if (matchCount > 0) {
      return {
        success: false as const,
        error: `This roster has ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}. Delete or reassign ${matchCount === 1 ? 'it' : 'them'} under Matches & Standings first.`,
      };
    }

    // The NOT EXISTS guard closes the window where a match is created after the count above.
    await db.delete(schema.rosters).where(
      and(
        eq(schema.rosters.id, rosterId),
        sql`not exists (select 1 from ${schema.matches} where ${schema.matches.homeRosterId} = ${rosterId} or ${schema.matches.awayRosterId} = ${rosterId})`,
      ),
    );
    updateTag('rosters');
    updateTag('players');
    updateTag('teams');
    updateTag('matches');
    refreshSchoolRosters(schoolId);
    revalidatePath('/');
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

export async function createRosterMember(schoolId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const rosterId = text(formData, 'rosterId');
    const memberId = text(formData, 'memberId');
    const role = parseRole(text(formData, 'role'));
    const ign = text(formData, 'ign');

    if (!rosterId || !memberId || !role) return { success: false, error: 'Roster, Member, and Role are required.' };

    // Both the roster and the member must belong to this school.
    if (!(await rosterInSchool(rosterId, schoolId)) || !(await memberInSchool(memberId, schoolId))) return NOT_FOUND;

    await db.insert(schema.players).values({
      rosterId,
      memberId,
      role,
      ign: ign || null,
      // Captain is a role, not a separate flag. Keep the boolean in sync so any
      // consumer reading isCaptain agrees with the displayed role.
      isCaptain: role === 'captain',
    });

    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    if (isCaptainConflict(error)) return { success: false, error: CAPTAIN_CONFLICT_MSG };
    return { success: false, error: 'Failed to register player. Note: A member can only be registered once per roster.' };
  }
}

export async function updateRosterMember(schoolId: string, playerId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const role = parseRole(text(formData, 'role'));
    const ign = text(formData, 'ign');
    if (!role) return { success: false, error: 'Pick a valid role.' };
    if (!(await playerInSchool(playerId, schoolId))) return NOT_FOUND;

    await db
      .update(schema.players)
      // Captaincy is derived from the role so the two never disagree.
      .set({ role, ign: ign || null, isCaptain: role === 'captain' })
      .where(eq(schema.players.id, playerId));

    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    if (isCaptainConflict(error)) return { success: false, error: CAPTAIN_CONFLICT_MSG };
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteRosterMember(schoolId: string, playerId: string) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    if (!(await playerInSchool(playerId, schoolId))) return NOT_FOUND;
    await db.delete(schema.players).where(eq(schema.players.id, playerId));
    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}
