import { describe, expect, it } from 'vitest';
import {
  buildSeasonStandingsComputedQuery,
  buildSeasonStandingsSnapshotQuery,
  buildSeasonSummarySnapshotQuery,
} from '@/app/lib/db/queries';

/**
 * A school is part of a game's season only through a `teams` row. These assert
 * the SQL of every public read that lists schools for a season, so a snapshot
 * row for a school without a team cannot leak back in. No database is involved.
 */
const TEAM_EXISTS = /exists \(select 1 from "teams" where "teams"\."school_id" = "season_standings"\."school_id" and "teams"\."season_id" = "season_standings"\."season_id"\)/;

describe('public school lists are scoped to teams in the season', () => {
  it('standings snapshot requires a team for the school in that season', () => {
    const { sql } = buildSeasonStandingsSnapshotQuery({
      seasonId: 's1',
      division: 'Varsity',
      combined: false,
    }).toSQL();
    expect(sql).toMatch(TEAM_EXISTS);
    expect(sql).toContain('"schools"."deleted_at" is null');
  });

  it('combined standings snapshot is scoped the same way', () => {
    const { sql } = buildSeasonStandingsSnapshotQuery({
      seasonId: 's1',
      division: 'Varsity',
      combined: true,
    }).toSQL();
    expect(sql).toMatch(TEAM_EXISTS);
  });

  it('hub summary snapshot requires a team in the season', () => {
    const { sql, params } = buildSeasonSummarySnapshotQuery('s1').toSQL();
    expect(sql).toMatch(TEAM_EXISTS);
    expect(params).toContain('s1');
  });

  it('computed standings stay team-backed and season-pinned', () => {
    const { sql } = buildSeasonStandingsComputedQuery({
      seasonId: 's1',
      division: 'Varsity',
      combined: false,
    }).toSQL();
    expect(sql).toContain('"teams"."season_id" = $');
  });
});
