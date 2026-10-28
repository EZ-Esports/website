import 'server-only';
import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import * as schema from './schema';
import type { DbOrTx } from './roster-scope';
import { dbErrorChain } from '../text-utils';

/**
 * Removing a player from a roster, plus the cleanup of the student's own record when removal leaves
 * nothing that needs it. ONE helper serves the staff action (`deleteRosterMember`), the manager
 * portal (`removePlayerFromRoster`) and a staff roster delete, so the rule cannot drift.
 *
 * What is deleted, and why only that
 * ----------------------------------
 * The `players` row is always deleted. Then, in the same transaction, the member is deleted too
 * (with its onboarding leftovers) if and only if it is an orphan: no other `players` row on any
 * roster or season, not staff / a school manager / a leadership or people profile, not a gold-archive
 * member, and no trace in match history. Nothing in the schema points at `players.id`, so history is
 * recognised by what the roster played and by in-game identity (see `findHistory`).
 *
 * Everything is fail-closed. The player delete always sticks, but the member cleanup runs in its own
 * savepoint: any doubt or unexpected error rolls back the cleanup alone and keeps the member. The
 * keep-checks (who must be preserved) have no tolerance at all: a missing table there keeps the
 * member. Only the delete counts and the match-history reads tolerate a missing table, and only
 * when the error names that very table (42P01/42703), because a table that is not migrated yet
 * holds nothing to delete and no history.
 *
 * The caller owns the transaction, the permission and school-scope checks, cache tags and the
 * post-commit notification.
 */

export type KeepReason =
  | 'other_roster'
  | 'staff'
  | 'school_manager'
  | 'profile'
  | 'archive_member'
  | 'match_history'
  | 'member_missing'
  | 'cleanup_error';

/** Plain-language reasons, shown to staff and managers next to "removed from roster". */
export const KEEP_REASON_TEXT: Record<KeepReason, string> = {
  other_roster: 'they are still on another roster',
  staff: 'they are a staff member',
  school_manager: 'they are a school manager',
  profile: 'they have a leadership or people profile',
  archive_member: 'they are in the league archive',
  match_history: 'they have match history',
  member_missing: 'their student record was already gone',
  cleanup_error: 'the cleanup could not be completed safely',
};

export interface DeletedCounts {
  consents: number;
  demographics: number;
  identities: number;
  contentFlags: number;
  invites: number;
}

export type RosterRemovalResult =
  | { removed: false }
  | { removed: true; memberId: string; studentRecord: 'deleted'; deleted: DeletedCounts }
  | { removed: true; memberId: string; studentRecord: 'kept'; keptReason: KeepReason };

/** Sentence for the UI after a removal. `removed: false` means a stale row (someone else got there first). */
export function removalNotice(result: RosterRemovalResult, studentName?: string): string {
  const who = studentName ? `${studentName} was` : 'The player was';
  if (!result.removed) return 'This player was already removed. Refresh the page.';
  if (result.studentRecord === 'deleted') {
    return `${who} removed from the roster and their onboarding record was deleted.`;
  }
  return `${who} removed from the roster. Their student record was kept because ${KEEP_REASON_TEXT[result.keptReason]}.`;
}

const UNDEFINED_TABLE = '42P01';
const UNDEFINED_COLUMN = '42703';

/**
 * True for "relation/column does not exist" that NAMES `table` (in this error's own message or its
 * cause chain). Scoping to the table keeps a missing unrelated table, or a typo in a column of a
 * required table, from being mistaken for "this optional table has not been migrated yet".
 */
export function isMissingRelationError(err: unknown, table: string): boolean {
  return dbErrorChain(err).some((e) => {
    const { code, message } = e as { code?: unknown; message?: unknown };
    if (code !== UNDEFINED_TABLE && code !== UNDEFINED_COLUMN) return false;
    return typeof message === 'string' && message.includes(`"${table}"`);
  });
}

/**
 * Runs one query in its own savepoint. A failed statement aborts a Postgres transaction, so catching
 * the error is only safe if the statement ran in a nested transaction that rolls back by itself.
 * Used ONLY for the delete counts and the history reads, where a table that is not in this database
 * yet cannot hold anything to delete or any history: `table` missing yields `whenMissing`. Every
 * other error, and every error about any other table, propagates and keeps the member. The
 * keep-checks (who must be preserved) never use it: they fail closed.
 */
async function optional<T>(tx: DbOrTx, table: string, run: (t: DbOrTx) => Promise<T>, whenMissing: T): Promise<T> {
  try {
    return await tx.transaction((t) => run(t as DbOrTx));
  } catch (err) {
    if (isMissingRelationError(err, table)) return whenMissing;
    throw err;
  }
}

/** Trimmed, whitespace-collapsed, lower-cased. Both sides of every name comparison go through this. */
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
/** The same normalisation in SQL, for a column. */
const normCol = (col: unknown) => sql`lower(regexp_replace(btrim(${col}), '[[:space:]]+', ' ', 'g'))`;
const inList = (values: string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  memberKey: string | null;
  schoolId: string;
}

/** Locks the member row so a concurrent enrol (which takes a key-share lock via the FK) waits for us. */
async function lockMember(tx: DbOrTx, memberId: string): Promise<MemberRow | null> {
  const [row] = await tx
    .select({
      id: schema.members.id,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      email: schema.members.email,
      memberKey: schema.members.memberKey,
      schoolId: schema.members.schoolId,
    })
    .from(schema.members)
    .where(eq(schema.members.id, memberId))
    .for('update')
    .limit(1);
  return row ?? null;
}

/**
 * Is there any record that this student played? Nothing references `players.id`, so this looks at:
 * the matches of the removed roster AND its sibling rosters (same team: a student can have played
 * for Varsity and JV) that have a result or are live/completed/forfeit; stored game data on those
 * matches; standings rows, match MVP text and stored Valorant scoreboards that name the student's
 * full name, in-game name or Riot id. Names are compared trimmed, whitespace-collapsed and
 * case-insensitively on both sides. Name matches are deliberately loose: a false match only keeps a
 * record that could have been deleted.
 *
 * Each read tolerates only its own table being absent from this database (see `optional`).
 */
async function findHistory(
  tx: DbOrTx,
  input: { rosterId: string; teamId: string | null; member: MemberRow; ign: string | null; riotIds: string[] },
): Promise<boolean> {
  const { rosterId, teamId, member, ign, riotIds } = input;

  // Required table: if rosters cannot be read the member is kept (the error propagates).
  const siblings = await tx
    .select({ id: schema.rosters.id })
    .from(schema.rosters)
    .where(teamId
      ? or(eq(schema.rosters.id, rosterId), eq(schema.rosters.teamId, teamId))
      : or(eq(schema.rosters.id, rosterId), sql`${schema.rosters.teamId} = (select team_id from rosters where id = ${rosterId})`));
  const rosterIds = [...new Set([rosterId, ...siblings.map((r) => r.id)])];
  const onRosters = or(inArray(schema.matches.homeRosterId, rosterIds), inArray(schema.matches.awayRosterId, rosterIds));

  const played = await optional(tx, 'matches', async (t) => {
    const rows = await t
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(and(
        onRosters,
        or(
          isNotNull(schema.matches.homeScore),
          isNotNull(schema.matches.awayScore),
          inArray(schema.matches.status, ['live', 'completed', 'forfeit']),
        ),
      ))
      .limit(1);
    return rows.length > 0;
  }, false);
  if (played) return true;

  const hasGames = await optional(tx, 'match_games', async (t) => {
    const rows = await t
      .select({ id: schema.matchGames.id })
      .from(schema.matchGames)
      .innerJoin(schema.matches, eq(schema.matchGames.matchId, schema.matches.id))
      .where(onRosters)
      .limit(1);
    return rows.length > 0;
  }, false);
  if (hasGames) return true;

  const fullName = norm(`${member.firstName} ${member.lastName}`);
  const handles = [ign, ...riotIds].map((h) => (h ? norm(h) : '')).filter((h) => h.length > 0);
  const names = [fullName, ...handles];

  const inStandings = await optional(tx, 'season_standings', async (t) => {
    const rows = await t
      .select({ id: schema.seasonStandings.id })
      .from(schema.seasonStandings)
      .where(or(
        sql`${normCol(schema.seasonStandings.playerName)} in (${inList(names)})`,
        sql`${normCol(schema.seasonStandings.playerIgn)} in (${inList(handles.length ? handles : [''])})`,
      ))
      .limit(1);
    return rows.length > 0;
  }, false);
  if (inStandings) return true;

  const mvp = await optional(tx, 'matches', async (t) => {
    const rows = await t
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(or(...names.map((n) => sql`position(${n} in ${normCol(schema.matches.mvp)}) > 0`)))
      .limit(1);
    return rows.length > 0;
  }, false);
  if (mvp) return true;

  if (handles.length === 0) return false;
  return optional(tx, 'valorant_game_players', async (t) => {
    const rows = await t
      .select({ id: schema.valorantGamePlayers.id })
      .from(schema.valorantGamePlayers)
      .where(or(
        // Name and tag are normalised separately, so padding around either does not break "name#tag".
        sql`${normCol(schema.valorantGamePlayers.name)} || '#' || ${normCol(schema.valorantGamePlayers.tag)} in (${inList(handles)})`,
        sql`${normCol(schema.valorantGamePlayers.name)} in (${inList(handles)})`,
      ))
      .limit(1);
    return rows.length > 0;
  }, false);
}

/**
 * First reason this member must be kept, or null when it is an orphan. Cheapest checks first.
 * FAIL CLOSED: none of these reads tolerates a missing table or column. Any error, including a
 * 42P01, propagates to `cleanupOrphanMember`, which keeps the member (`cleanup_error`).
 */
async function keepReason(
  tx: DbOrTx,
  input: { memberId: string; rosterId: string; teamId: string | null; ign: string | null; member: MemberRow },
): Promise<KeepReason | null> {
  const { memberId, member } = input;
  const email = member.email ? norm(member.email) : null;
  const first = norm(member.firstName);
  const last = norm(member.lastName);
  // One round trip for every cheap keep-check. Each flag is an EXISTS subquery, so any error (a
  // missing table included) still propagates and keeps the member.
  const [flags] = await tx.select({
    otherRoster: sql<boolean>`exists (select 1 from ${schema.players} where ${schema.players.memberId} = ${memberId})`,
    staff: sql<boolean>`exists (select 1 from ${schema.staffMembers} where ${schema.staffMembers.memberId} = ${memberId}${
      email ? sql` or lower(btrim(${schema.staffMembers.email})) = ${email}` : sql``})`,
    schoolManager: sql<boolean>`exists (select 1 from ${schema.schoolManagers} where ${schema.schoolManagers.memberId} = ${memberId})`,
    // manager_invites and school_managers have no email column, so a manager invite is matched by the
    // member link or by the intended name at the member's own school (same-name is ambiguous: keep).
    managerInvite: sql<boolean>`exists (select 1 from ${schema.managerInvites} where ${schema.managerInvites.memberId} = ${memberId}
      or (${schema.managerInvites.schoolId} = ${member.schoolId}
        and ${normCol(schema.managerInvites.intendedFirstName)} = ${first}
        and ${normCol(schema.managerInvites.intendedLastName)} = ${last}))`,
    leadership: sql<boolean>`exists (select 1 from ${schema.leadership} where ${schema.leadership.memberId} = ${memberId})`,
    people: sql<boolean>`exists (select 1 from ${schema.people} where ${schema.people.memberId} = ${memberId}${
      email ? sql` or lower(btrim(${schema.people.email})) = ${email}` : sql``})`,
  }).from(schema.members).where(eq(schema.members.id, memberId));
  if (!flags) return 'cleanup_error';
  if (flags.otherRoster) return 'other_roster';
  if (flags.staff) return 'staff';
  if (flags.schoolManager || flags.managerInvite) return 'school_manager';
  if (flags.leadership || flags.people) return 'profile';

  if (member.memberKey) return 'archive_member';

  const riotRows = await tx
    .select({ id: schema.playerIdentities.providerUserId })
    .from(schema.playerIdentities)
    .where(and(eq(schema.playerIdentities.memberId, memberId), eq(schema.playerIdentities.provider, 'riot')));
  if (await findHistory(tx, {
    rosterId: input.rosterId, teamId: input.teamId, member, ign: input.ign, riotIds: riotRows.map((r) => r.id),
  })) {
    return 'match_history';
  }
  return null;
}

/** Deletes one table's rows for the member; the table being absent from this database counts as zero. */
async function deleteCount(tx: DbOrTx, table: string, run: (t: DbOrTx) => Promise<unknown[]>): Promise<number> {
  return optional(tx, table, async (t) => (await run(t)).length, 0);
}

/**
 * Deletes the onboarding leftovers and the member itself. Order matters: consents, demographics and
 * identities would cascade anyway but are removed explicitly so the counts are known; the player
 * invites are removed (not reset) because an accepted invite is spent and its token must never work
 * again; the member row goes last. `players` restricts the member delete, a final guard.
 */
async function deleteMember(tx: DbOrTx, memberId: string): Promise<DeletedCounts> {
  const consents = await deleteCount(tx, 'onboarding_consents', (t) => t.delete(schema.onboardingConsents)
    .where(eq(schema.onboardingConsents.memberId, memberId)).returning({ id: schema.onboardingConsents.id }));
  const demographics = await deleteCount(tx, 'student_demographics', (t) => t.delete(schema.studentDemographics)
    .where(eq(schema.studentDemographics.memberId, memberId)).returning({ id: schema.studentDemographics.id }));
  const identities = await deleteCount(tx, 'player_identities', (t) => t.delete(schema.playerIdentities)
    .where(eq(schema.playerIdentities.memberId, memberId)).returning({ id: schema.playerIdentities.id }));
  const contentFlags = await deleteCount(tx, 'onboarding_content_flags', (t) => t.delete(schema.onboardingContentFlags)
    .where(eq(schema.onboardingContentFlags.memberId, memberId)).returning({ id: schema.onboardingContentFlags.id }));
  const invites = await deleteCount(tx, 'player_invites', (t) => t.delete(schema.playerInvites)
    .where(eq(schema.playerInvites.memberId, memberId)).returning({ id: schema.playerInvites.id }));
  const gone = await tx.delete(schema.members).where(eq(schema.members.id, memberId))
    .returning({ id: schema.members.id });
  if (gone.length !== 1) throw new Error('member delete affected an unexpected number of rows');
  return { consents, demographics, identities, contentFlags, invites };
}

type CleanupOutcome =
  | { studentRecord: 'deleted'; deleted: DeletedCounts }
  | { studentRecord: 'kept'; keptReason: KeepReason };

/**
 * Deletes the member if it is an orphan, else reports why it stays. Call it inside a transaction,
 * after the player row is gone. Runs in a savepoint: on any error the cleanup alone is undone.
 */
export async function cleanupOrphanMember(
  tx: DbOrTx,
  input: { memberId: string; rosterId: string; ign?: string | null; teamId?: string | null },
): Promise<CleanupOutcome> {
  try {
    return await tx.transaction(async (sp): Promise<CleanupOutcome> => {
      const s = sp as DbOrTx;
      const member = await lockMember(s, input.memberId);
      if (!member) return { studentRecord: 'kept', keptReason: 'member_missing' };
      const reason = await keepReason(s, { ...input, ign: input.ign ?? null, teamId: input.teamId ?? null, member });
      if (reason) return { studentRecord: 'kept', keptReason: reason };
      return { studentRecord: 'deleted', deleted: await deleteMember(s, input.memberId) };
    });
  } catch (err) {
    // Fail closed: keep the member. Log the Postgres code only, never row data.
    const code = dbErrorChain(err).map((e) => (e as { code?: unknown }).code).find((c) => typeof c === 'string');
    console.error('roster removal cleanup skipped:', typeof code === 'string' ? code : 'unexpected error');
    return { studentRecord: 'kept', keptReason: 'cleanup_error' };
  }
}

/**
 * Deletes the `players` row (guarded by its roster, so a stale or already-moved row matches nothing)
 * and then runs the orphan cleanup. Pass the caller's transaction.
 */
export async function removePlayerFromRosterTx(
  tx: DbOrTx,
  input: { playerId: string; rosterId: string },
): Promise<RosterRemovalResult> {
  const deleted = await tx
    .delete(schema.players)
    .where(and(eq(schema.players.id, input.playerId), eq(schema.players.rosterId, input.rosterId)))
    .returning({ memberId: schema.players.memberId, ign: schema.players.ign });
  const row = deleted[0];
  if (!row) return { removed: false };
  const outcome = await cleanupOrphanMember(tx, { memberId: row.memberId, rosterId: input.rosterId, ign: row.ign });
  return { removed: true, memberId: row.memberId, ...outcome };
}

/** Cache tags a removal can change. Members/people-facing tags matter only when a member was deleted. */
export function removalCacheTags(result: RosterRemovalResult): string[] {
  const tags = ['rosters', 'players'];
  if (result.removed && result.studentRecord === 'deleted') tags.push('members');
  return tags;
}
