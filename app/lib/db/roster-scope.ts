import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from './index';
import * as schema from './schema';

type TransactionExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** The shared connection, or the transaction a multi-write action is running in. */
export type DbOrTx = typeof db | TransactionExecutor;

/**
 * School-scope checks for the staff roster editing actions. Every id an
 * action receives (team, roster, player, member) is resolved through the
 * school it claims to belong to, so a staff form for school A can never
 * write to school B's data by swapping an id. Each returns null/false when the
 * row does not exist or belongs elsewhere. Each takes an optional executor so a
 * multi-write action can resolve ids inside its own transaction.
 */

export async function teamInSchool(teamId: string, schoolId: string, executor: DbOrTx = db) {
  const [row] = await executor
    .select({ id: schema.teams.id, gameSlug: schema.games.slug })
    .from(schema.teams)
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .where(and(eq(schema.teams.id, teamId), eq(schema.teams.schoolId, schoolId)))
    .limit(1);
  return row ?? null;
}

export async function rosterInSchool(rosterId: string, schoolId: string, executor: DbOrTx = db) {
  const [row] = await executor
    .select({
      id: schema.rosters.id,
      teamId: schema.rosters.teamId,
      name: schema.rosters.name,
      division: schema.rosters.division,
      gameSlug: schema.games.slug,
    })
    .from(schema.rosters)
    .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
    .innerJoin(schema.games, eq(schema.teams.gameId, schema.games.id))
    .where(and(eq(schema.rosters.id, rosterId), eq(schema.teams.schoolId, schoolId)))
    .limit(1);
  return row ?? null;
}

export async function playerInSchool(playerId: string, schoolId: string, executor: DbOrTx = db) {
  const [row] = await executor
    .select({
      id: schema.players.id,
      rosterId: schema.players.rosterId,
      memberId: schema.players.memberId,
      role: schema.players.role,
      isCaptain: schema.players.isCaptain,
    })
    .from(schema.players)
    .innerJoin(schema.rosters, eq(schema.players.rosterId, schema.rosters.id))
    .innerJoin(schema.teams, eq(schema.rosters.teamId, schema.teams.id))
    .where(and(eq(schema.players.id, playerId), eq(schema.teams.schoolId, schoolId)))
    .limit(1);
  return row ?? null;
}

export async function memberInSchool(memberId: string, schoolId: string, executor: DbOrTx = db): Promise<boolean> {
  const [row] = await executor
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(and(eq(schema.members.id, memberId), eq(schema.members.schoolId, schoolId)))
    .limit(1);
  return Boolean(row);
}

/** Whether the member already has a players row on this exact roster. */
export async function memberOnRoster(memberId: string, rosterId: string, executor: DbOrTx = db): Promise<boolean> {
  const [row] = await executor
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(and(eq(schema.players.rosterId, rosterId), eq(schema.players.memberId, memberId)))
    .limit(1);
  return Boolean(row);
}

/**
 * League rule: a student plays a game for one tier at a time. Rosters of one team (one school,
 * one game, one season) are siblings, so a member may be on at most one of them. Returns the
 * sibling roster the member is already on (other than `exceptRosterId`), or null. Different
 * games are different teams, so Varsity in one game and JV in another is allowed.
 */
export async function siblingEnrollment(
  teamId: string,
  memberId: string,
  exceptRosterId: string,
  executor: DbOrTx = db,
): Promise<{ playerId: string; rosterId: string; rosterName: string } | null> {
  const teamRosters = await executor
    .select({ id: schema.rosters.id, name: schema.rosters.name })
    .from(schema.rosters)
    .where(eq(schema.rosters.teamId, teamId));
  const siblings = teamRosters.filter((r) => r.id !== exceptRosterId);
  if (siblings.length === 0) return null;

  const memberRows = await executor
    .select({ id: schema.players.id, rosterId: schema.players.rosterId })
    .from(schema.players)
    .where(eq(schema.players.memberId, memberId));
  const hit = memberRows.find((p) => siblings.some((r) => r.id === p.rosterId));
  if (!hit) return null;
  const roster = siblings.find((r) => r.id === hit.rosterId)!;
  return { playerId: hit.id, rosterId: roster.id, rosterName: roster.name };
}

/** "First Last" for messages that name a member; falls back to a neutral phrase if the row is gone. */
export async function memberDisplayName(memberId: string, executor: DbOrTx = db): Promise<string> {
  const [row] = await executor
    .select({ firstName: schema.members.firstName, lastName: schema.members.lastName })
    .from(schema.members)
    .where(eq(schema.members.id, memberId))
    .limit(1);
  return row ? `${row.firstName} ${row.lastName}` : 'That member';
}
