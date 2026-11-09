import { and, eq, isNotNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { seasonSchools } from './schema';

/**
 * Season membership (spec-060). A school is "in" a game's season when a `season_schools` row exists for
 * (school, game, season); rosters, players and matches belong to the school and season on their own and
 * never depend on that row, so these helpers are how a read says "and the school is a member".
 */

interface Scoped {
  schoolId: PgColumn;
  gameId: PgColumn;
  seasonId: PgColumn;
}

/** True when `a` (a roster, or anything with the three scope columns) lies in the membership row's scope. */
export function inScope(a: Scoped, membership: Scoped): SQL {
  return and(
    eq(a.schoolId, membership.schoolId),
    eq(a.gameId, membership.gameId),
    eq(a.seasonId, membership.seasonId),
  )!;
}

/**
 * Join condition from a `season_standings` snapshot row to its membership. A snapshot has a school and a
 * season but no game column; a season belongs to exactly one game, so (school, season) picks the one row.
 * Migration 0060 backfilled membership for every archived snapshot, which is what makes this safe.
 */
export function snapshotMember(snapshot: { schoolId: PgColumn; seasonId: PgColumn }): SQL {
  return and(eq(snapshot.schoolId, seasonSchools.schoolId), eq(snapshot.seasonId, seasonSchools.seasonId))!;
}

/**
 * Both sides of a match are members of the season. Pair it with LEFT joins of the membership alias on
 * each roster, so staff reads (which omit this) still see a match whose school was removed, while public
 * reads hide it.
 */
export function bothMembers(home: { id: PgColumn }, away: { id: PgColumn }): SQL {
  return and(isNotNull(home.id), isNotNull(away.id))!;
}
