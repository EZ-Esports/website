import { describe, expect, it } from 'vitest';
import {
  buildHubMatchQuery,
  buildMatchesPageQuery,
  buildSeasonMatchesQuery,
  buildSeasonStandingsComputedQuery,
} from '@/app/lib/db/queries';

/**
 * A team staff removed from a season (teams.removed_at, spec-058) must vanish from every public
 * read and its fixtures with it, while staff reads still see them. These compile the builders and
 * look for the guard, since the real database is never touched here.
 */
const GUARD = '"removed_at" is null';

describe('public reads skip removed teams', () => {
  it('the public match list guards both sides; the staff list does not', () => {
    const pub = buildMatchesPageQuery({}, true).toSQL().sql;
    expect(pub).toContain('"home_team"."removed_at" is null');
    expect(pub).toContain('"away_team"."removed_at" is null');
    expect(buildMatchesPageQuery({}, false).toSQL().sql).not.toContain('removed_at');
  });

  it('the season calendar guards only for the public variant', () => {
    expect(buildSeasonMatchesQuery('s', undefined, true).toSQL().sql).toContain(GUARD);
    expect(buildSeasonMatchesQuery('s').toSQL().sql).not.toContain('removed_at');
  });

  it('the hub match query and the computed standings skip removed teams', () => {
    const hub = buildHubMatchQuery({ seasonId: 's', division: 'Varsity', conditions: [], direction: 'asc', limit: 5 }).toSQL().sql;
    expect(hub).toContain('"home_team"."removed_at" is null');
    expect(buildSeasonStandingsComputedQuery({ seasonId: 's', division: 'Varsity', combined: false }).toSQL().sql).toContain(
      '"teams"."removed_at" is null',
    );
  });
});
