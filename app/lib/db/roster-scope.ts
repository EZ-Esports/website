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
    .select({ id: schema.players.id, rosterId: schema.players.rosterId, memberId: schema.players.memberId })
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
