'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, count, eq, or, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { dbErrorChain, sanitizeDbError } from '@/app/lib/text-utils';
import {
  lockRosterMember, memberDisplayName, memberInSchool, memberOnRoster, playerInSchool, rosterInSchool, siblingEnrollment, teamInSchool,
} from '@/app/lib/db/roster-scope';
import { notifyRosterMembershipChanged } from '@/app/lib/onboarding/roster-membership-events';
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

/**
 * Tells the roster-membership seam who changed. Called only after the write has committed; the
 * change is already durable, so a failing consumer must not turn it into an error.
 */
async function notifyMembershipChanged(memberIds: string[]): Promise<void> {
  try {
    await notifyRosterMembershipChanged(memberIds);
  } catch (error) {
    console.error('notifyRosterMembershipChanged failed:', error instanceof Error ? error.message : 'unknown error');
  }
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
        error: `This roster has ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}. Delete or reassign ${matchCount === 1 ? 'it' : 'them'} under Matches first.`,
      };
    }

    // Deleting a roster cascades to its players, so remember who was on it for the seam.
    const affected = await db
      .select({ memberId: schema.players.memberId })
      .from(schema.players)
      .where(eq(schema.players.rosterId, rosterId));

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
    await notifyMembershipChanged(affected.map((p) => p.memberId).filter(Boolean));
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
  // drizzle wraps the driver error: the Postgres error is on `.cause`, so check the whole chain.
  return dbErrorChain(error).some((err) => {
    const e = err as { constraint_name?: string; message?: string };
    return e?.constraint_name === 'players_roster_one_captain_idx'
      || (typeof e?.message === 'string' && e.message.includes('players_roster_one_captain_idx'));
  });
}
const CAPTAIN_CONFLICT_MSG = 'This roster already has a captain. Demote the current captain before assigning a new one.';

/** Failure for the one-save player actions: nothing was committed, and the toast says so. */
function playerFail(error: string) {
  return { success: false as const, error: `${error} Nothing was saved.` };
}

/**
 * Adds a player to a roster in ONE save. The form either names an existing school member
 * (`memberId`) or carries new-member fields (`firstName`, `lastName`, `discord`, `graduationYear`);
 * the member insert and the player insert share one transaction, so a failed player insert
 * (duplicate member on the roster, a second captain) leaves no orphan member behind.
 */
export async function createPlayer(schoolId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const rosterId = text(formData, 'rosterId');
    const memberId = text(formData, 'memberId');
    const role = parseRole(text(formData, 'role'));
    const ign = text(formData, 'ign');
    const firstName = text(formData, 'firstName');
    const lastName = text(formData, 'lastName');
    const discord = text(formData, 'discord');
    const gradYear = parseGradYear(text(formData, 'graduationYear'));

    if (!rosterId || !role) return playerFail('Roster and Role are required.');
    if (!memberId) {
      if (!firstName || !lastName) return playerFail('Pick a member, or enter a first and last name.');
      if (gradYear === 'invalid') return playerFail('Class year must be a four-digit year.');
    }

    const outcome = await db.transaction(async (tx) => {
      // The roster and any existing member must belong to this school.
      const roster = await rosterInSchool(rosterId, schoolId, tx);
      if (!roster) return 'not-found' as const;
      if (memberId && !(await memberInSchool(memberId, schoolId, tx))) return 'not-found' as const;

      // One tier per game: a member already on a sibling roster is moved, not added a second time.
      // The lock serializes concurrent adds/moves of this member within the team, so two requests
      // cannot both pass the check.
      if (memberId) {
        await lockRosterMember(tx, roster.teamId, memberId);
        const sibling = await siblingEnrollment(roster.teamId, memberId, rosterId, tx);
        if (sibling) {
          const name = await memberDisplayName(memberId, tx);
          return { kind: 'conflict' as const, message: `${name} is already on ${sibling.rosterName}. Use Move to put them on ${roster.name}.` };
        }
      }

      let memberIdToUse = memberId;
      if (!memberId) {
        const [member] = await tx
          .insert(schema.members)
          .values({ firstName, lastName, schoolId, discord: discord || null, graduationYear: gradYear as number | null })
          .returning({ id: schema.members.id });
        memberIdToUse = member.id;
      }

      await tx.insert(schema.players).values({
        rosterId,
        memberId: memberIdToUse,
        role,
        ign: ign || null,
        // Captain is a role, not a separate flag. Keep the boolean in sync so any
        // consumer reading isCaptain agrees with the displayed role.
        isCaptain: role === 'captain',
      });
      return { kind: 'ok' as const, memberId: memberIdToUse };
    });
    if (outcome === 'not-found') return playerFail(NOT_FOUND.error);
    if (outcome.kind === 'conflict') return playerFail(outcome.message);

    if (!memberId) updateTag('members');
    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    await notifyMembershipChanged([outcome.memberId]);
    return { success: true as const };
  } catch (error: unknown) {
    console.error(error);
    if (isCaptainConflict(error)) return playerFail(CAPTAIN_CONFLICT_MSG);
    return playerFail('Failed to register player. Note: A member can only be registered once per roster.');
  }
}

/**
 * Edits a player in ONE save: role and in-game name (this roster) plus the member's name, Discord
 * and class year. The member is derived from the player row, never taken from the form, and both
 * updates share one transaction so a failed role change (a second captain) does not leave the
 * member details half-edited. Email and the school are never touched.
 */
export async function updatePlayer(schoolId: string, playerId: string, formData: FormData) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const role = parseRole(text(formData, 'role'));
    const ign = text(formData, 'ign');
    const firstName = text(formData, 'firstName');
    const lastName = text(formData, 'lastName');
    const discord = text(formData, 'discord');
    const gradYear = parseGradYear(text(formData, 'graduationYear'));

    if (!role) return playerFail('Pick a valid role.');
    if (!firstName || !lastName) return playerFail('First and last name are required.');
    if (gradYear === 'invalid') return playerFail('Class year must be a four-digit year.');

    const outcome = await db.transaction(async (tx) => {
      const player = await playerInSchool(playerId, schoolId, tx);
      if (!player || !(await memberInSchool(player.memberId, schoolId, tx))) return 'not-found' as const;

      await tx
        .update(schema.players)
        // Captaincy is derived from the role so the two never disagree.
        .set({ role, ign: ign || null, isCaptain: role === 'captain' })
        .where(eq(schema.players.id, playerId));
      await tx
        .update(schema.members)
        .set({ firstName, lastName, discord: discord || null, graduationYear: gradYear })
        .where(eq(schema.members.id, player.memberId));
      return { memberId: player.memberId };
    });
    if (outcome === 'not-found') return playerFail(NOT_FOUND.error);

    updateTag('members');
    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    // A role change (captain, coach, sub) can change what the member should be granted elsewhere.
    await notifyMembershipChanged([outcome.memberId]);
    return { success: true as const };
  } catch (error: unknown) {
    console.error(error);
    if (isCaptainConflict(error)) return playerFail(CAPTAIN_CONFLICT_MSG);
    return playerFail(sanitizeDbError(error));
  }
}

export async function deleteRosterMember(schoolId: string, playerId: string) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const player = await playerInSchool(playerId, schoolId);
    if (!player) return NOT_FOUND;
    await db.delete(schema.players).where(eq(schema.players.id, playerId));
    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    await notifyMembershipChanged([player.memberId]);
    return { success: true };
  } catch (error: unknown) {
    console.error(error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

/**
 * Moves a player to a sibling roster of the same team (for example Varsity to JV), keeping the
 * players row so the in-game name and bio survive. Staff bypass the season roster lock like every
 * other action in this file. A captain arrives as a starter (captaincy is per roster). The move is
 * refused across teams, onto a roster the member is already on, and for a player outside this school.
 */
export async function moveRosterMember(schoolId: string, playerId: string, toRosterId: string) {
  await requireRosterPermission();
  if (!UUID.test(schoolId)) return BAD_SCHOOL;
  try {
    const outcome = await db.transaction(async (tx) => {
      const player = await playerInSchool(playerId, schoolId, tx);
      if (!player) return { error: NOT_FOUND.error };
      const from = await rosterInSchool(player.rosterId, schoolId, tx);
      const to = await rosterInSchool(toRosterId, schoolId, tx);
      if (!from || !to) return { error: NOT_FOUND.error };
      if (from.id === to.id) return { error: 'Pick a different roster to move the player to.' };
      if (from.teamId !== to.teamId) {
        return { error: 'Players can only be moved between rosters of the same team (same school, game and season).' };
      }
      // Serialize with concurrent adds/moves of this member within the team.
      await lockRosterMember(tx, from.teamId, player.memberId);
      if (await memberOnRoster(player.memberId, to.id, tx)) {
        const name = await memberDisplayName(player.memberId, tx);
        return { error: `${name} is already on ${to.name}.` };
      }

      const wasCaptain = player.isCaptain || player.role === 'captain';
      // Guarded by the roster we read the player on: if someone else moved or removed the row in
      // the meantime nothing matches and we say so instead of overwriting their change.
      const updated = await tx
        .update(schema.players)
        // players_captain_role_check ties role='captain' to is_captain, so demote both together.
        .set({ rosterId: to.id, role: wasCaptain ? 'player' : player.role, isCaptain: false, updatedAt: new Date() })
        .where(and(eq(schema.players.id, playerId), eq(schema.players.rosterId, from.id)))
        .returning({ id: schema.players.id });
      if (updated.length === 0) {
        return { error: 'This player was just moved or removed by someone else. Refresh the page and try again.' };
      }
      return { memberId: player.memberId, fromName: from.name, toName: to.name, wasCaptain };
    });
    if ('error' in outcome) return { success: false as const, error: outcome.error };

    updateTag('players');
    updateTag('rosters');
    refreshSchoolRosters(schoolId);
    await notifyMembershipChanged([outcome.memberId]);
    return { success: true as const, fromName: outcome.fromName, toName: outcome.toName, wasCaptain: outcome.wasCaptain };
  } catch (error: unknown) {
    console.error(error);
    return { success: false as const, error: sanitizeDbError(error) };
  }
}
