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
 * savepoint: any doubt or unexpected error rolls back the cleanup alone and keeps the member. A table
 * that does not exist in this database (42P01/42703) cannot hold references, so it is treated as empty
 * instead of failing the removal.
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

/** True for "relation/column does not exist": the schema in this database is behind the code. */
export function isMissingRelationError(err: unknown): boolean {
  return dbErrorChain(err).some((e) => {
    const code = (e as { code?: unknown }).code;
    return code === UNDEFINED_TABLE || code === UNDEFINED_COLUMN;
  });
}

/**
 * Runs one query in its own savepoint. A failed statement aborts a Postgres transaction, so catching
 * the error is only safe if the statement ran in a nested transaction that rolls back by itself.
 * A missing table or column yields `whenMissing`; any other error propagates (and keeps the member).
 */
async function optional<T>(tx: DbOrTx, run: (t: DbOrTx) => Promise<T>, whenMissing: T): Promise<T> {
  try {
    return await tx.transaction((t) => run(t as DbOrTx));
  } catch (err) {
    if (isMissingRelationError(err)) return whenMissing;
    throw err;
  }
}

const lower = (s: string) => s.trim().toLowerCase();

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  memberKey: string | null;
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
    })
    .from(schema.members)
    .where(eq(schema.members.id, memberId))
    .for('update')
    .limit(1);
  return row ?? null;
}

/**
 * Is there any record that this student played? Nothing references `players.id`, so this looks at:
 * the removed roster's matches that have a result or are live/completed/forfeit; stored game data on
 * those matches; standings rows, match MVP text and stored Valorant scoreboards that name the
 * student's full name, in-game name or Riot id. Name matches are deliberately loose: a false match
 * only keeps a record that could have been deleted.
 */
async function findHistory(
  tx: DbOrTx,
  input: { rosterId: string; member: MemberRow; ign: string | null; riotIds: string[] },
): Promise<boolean> {
  const { rosterId, member, ign, riotIds } = input;
  const onRoster = or(eq(schema.matches.homeRosterId, rosterId), eq(schema.matches.awayRosterId, rosterId));

  const played = await optional(tx, async (t) => {
    const rows = await t
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(and(
        onRoster,
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

  const hasGames = await optional(tx, async (t) => {
    const rows = await t
      .select({ id: schema.matchGames.id })
      .from(schema.matchGames)
      .innerJoin(schema.matches, eq(schema.matchGames.matchId, schema.matches.id))
      .where(onRoster)
      .limit(1);
    return rows.length > 0;
  }, false);
  if (hasGames) return true;

  const fullName = lower(`${member.firstName} ${member.lastName}`);
  const handles = [ign, ...riotIds].map((h) => (h ? lower(h) : '')).filter((h) => h.length > 0);
  const names = [fullName, ...handles];

  const inStandings = await optional(tx, async (t) => {
    const rows = await t
      .select({ id: schema.seasonStandings.id })
      .from(schema.seasonStandings)
      .where(or(
        sql`lower(${schema.seasonStandings.playerName}) in (${sql.join(names.map((n) => sql`${n}`), sql`, `)})`,
        sql`lower(${schema.seasonStandings.playerIgn}) in (${sql.join(handles.length ? handles.map((n) => sql`${n}`) : [sql`''`], sql`, `)})`,
      ))
      .limit(1);
    return rows.length > 0;
  }, false);
  if (inStandings) return true;

  const mvp = await optional(tx, async (t) => {
    const rows = await t
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(or(...names.map((n) => sql`position(${n} in lower(${schema.matches.mvp})) > 0`)))
      .limit(1);
    return rows.length > 0;
  }, false);
  if (mvp) return true;

  if (handles.length === 0) return false;
  return optional(tx, async (t) => {
    const rows = await t
      .select({ id: schema.valorantGamePlayers.id })
      .from(schema.valorantGamePlayers)
      .where(or(
        sql`lower(${schema.valorantGamePlayers.name} || '#' || ${schema.valorantGamePlayers.tag}) in (${sql.join(handles.map((n) => sql`${n}`), sql`, `)})`,
        sql`lower(${schema.valorantGamePlayers.name}) in (${sql.join(handles.map((n) => sql`${n}`), sql`, `)})`,
      ))
      .limit(1);
    return rows.length > 0;
  }, false);
}

/** First reason this member must be kept, or null when it is an orphan. Cheapest checks first. */
async function keepReason(
  tx: DbOrTx,
  input: { memberId: string; rosterId: string; ign: string | null; member: MemberRow },
): Promise<KeepReason | null> {
  const { memberId, member } = input;
  const email = member.email ? lower(member.email) : null;
  const exists = (run: (t: DbOrTx) => Promise<unknown[]>) => optional(tx, async (t) => (await run(t)).length > 0, false);

  if (await exists((t) => t.select({ id: schema.players.id }).from(schema.players)
    .where(eq(schema.players.memberId, memberId)).limit(1))) return 'other_roster';

  if (await exists((t) => t.select({ id: schema.staffMembers.userId }).from(schema.staffMembers)
    .where(email
      ? or(eq(schema.staffMembers.memberId, memberId), sql`lower(${schema.staffMembers.email}) = ${email}`)
      : eq(schema.staffMembers.memberId, memberId)).limit(1))) return 'staff';

  if (await exists((t) => t.select({ id: schema.schoolManagers.id }).from(schema.schoolManagers)
    .where(eq(schema.schoolManagers.memberId, memberId)).limit(1))) return 'school_manager';
  if (await exists((t) => t.select({ id: schema.managerInvites.id }).from(schema.managerInvites)
    .where(eq(schema.managerInvites.memberId, memberId)).limit(1))) return 'school_manager';

  if (await exists((t) => t.select({ id: schema.leadership.id }).from(schema.leadership)
    .where(eq(schema.leadership.memberId, memberId)).limit(1))) return 'profile';
  if (await exists((t) => t.select({ id: schema.people.id }).from(schema.people)
    .where(email
      ? or(eq(schema.people.memberId, memberId), sql`lower(${schema.people.email}) = ${email}`)
      : eq(schema.people.memberId, memberId)).limit(1))) return 'profile';

  if (member.memberKey) return 'archive_member';

  const riotRows = await optional(tx, (t) => t
    .select({ id: schema.playerIdentities.providerUserId })
    .from(schema.playerIdentities)
    .where(and(eq(schema.playerIdentities.memberId, memberId), eq(schema.playerIdentities.provider, 'riot'))),
  [] as Array<{ id: string }>);
  if (await findHistory(tx, { rosterId: input.rosterId, member, ign: input.ign, riotIds: riotRows.map((r) => r.id) })) {
    return 'match_history';
  }
  return null;
}

/** Deletes one table's rows for the member; a table missing from this database counts as zero. */
async function deleteCount(tx: DbOrTx, run: (t: DbOrTx) => Promise<unknown[]>): Promise<number> {
  return optional(tx, async (t) => (await run(t)).length, 0);
}

/**
 * Deletes the onboarding leftovers and the member itself. Order matters: consents, demographics and
 * identities would cascade anyway but are removed explicitly so the counts are known; the player
 * invites are removed (not reset) because an accepted invite is spent and its token must never work
 * again; the member row goes last. `players` restricts the member delete, a final guard.
 */
async function deleteMember(tx: DbOrTx, memberId: string): Promise<DeletedCounts> {
  const consents = await deleteCount(tx, (t) => t.delete(schema.onboardingConsents)
    .where(eq(schema.onboardingConsents.memberId, memberId)).returning({ id: schema.onboardingConsents.id }));
  const demographics = await deleteCount(tx, (t) => t.delete(schema.studentDemographics)
    .where(eq(schema.studentDemographics.memberId, memberId)).returning({ id: schema.studentDemographics.id }));
  const identities = await deleteCount(tx, (t) => t.delete(schema.playerIdentities)
    .where(eq(schema.playerIdentities.memberId, memberId)).returning({ id: schema.playerIdentities.id }));
  const invites = await deleteCount(tx, (t) => t.delete(schema.playerInvites)
    .where(eq(schema.playerInvites.memberId, memberId)).returning({ id: schema.playerInvites.id }));
  const gone = await tx.delete(schema.members).where(eq(schema.members.id, memberId))
    .returning({ id: schema.members.id });
  if (gone.length !== 1) throw new Error('member delete affected an unexpected number of rows');
  return { consents, demographics, identities, invites };
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
  input: { memberId: string; rosterId: string; ign?: string | null },
): Promise<CleanupOutcome> {
  try {
    return await tx.transaction(async (sp): Promise<CleanupOutcome> => {
      const s = sp as DbOrTx;
      const member = await lockMember(s, input.memberId);
      if (!member) return { studentRecord: 'kept', keptReason: 'member_missing' };
      const reason = await keepReason(s, { ...input, ign: input.ign ?? null, member });
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
