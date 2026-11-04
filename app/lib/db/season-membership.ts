import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import * as schema from './schema';

/**
 * True unless staff removed this school from this season (`teams.removed_at`, spec-058). For public
 * reads keyed on `season_standings` or `schools` alone, which have no team join to filter on.
 *
 * Deliberately the negative form ("no removed team") and not "has a live team": archived seasons
 * were imported as standings snapshots, and a school with a snapshot row but no team row must keep
 * showing, as it always has.
 */
export function schoolNotRemovedFromSeason(schoolId: AnyColumn, seasonId: AnyColumn): SQL {
  return sql`not exists (select 1 from ${schema.teams} where ${schema.teams.schoolId} = ${schoolId} and ${schema.teams.seasonId} = ${seasonId} and ${schema.teams.removedAt} is not null)`;
}
