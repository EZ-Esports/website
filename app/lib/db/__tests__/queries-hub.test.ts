import { describe, expect, it } from 'vitest';
import { eq, gte, isNotNull } from 'drizzle-orm';
import { buildHubMatchQuery } from '@/app/lib/db/queries';
import * as schema from '@/app/lib/db/schema';
import { HUB_DIVISIONS, toHubDivision } from '@/app/lib/db/match-page';

/**
 * `buildHubMatchQuery` is the game hub's whole match story: which matches
 * belong to a division, which ones count as "next", and how many rows come
 * back. All three now live in SQL, so this suite asserts the SQL drizzle
 * generates rather than a live result set — no database is involved, and the
 * assertions still fail if any of those three decisions moves back into
 * memory.
 */
const NEXT_MATCH = {
  seasonId: 'season-1',
  conditions: [
    eq(schema.matches.status, 'scheduled'),
    gte(schema.matches.scheduledAt, new Date('2026-07-25T12:00:00.000Z')),
  ],
  direction: 'asc' as const,
  limit: 1,
};

const RECENT_RESULTS = {
  seasonId: 'season-1',
  conditions: [
    eq(schema.matches.status, 'completed'),
    isNotNull(schema.matches.homeScore),
    isNotNull(schema.matches.awayScore),
  ],
  direction: 'desc' as const,
  limit: 3,
};

const compile = (opts: Parameters<typeof buildHubMatchQuery>[0]) =>
  buildHubMatchQuery(opts).toSQL();

describe('buildHubMatchQuery — cross-division attribution', () => {
  it.each(HUB_DIVISIONS)('judges each side of the match by its own roster (%s)', (division) => {
    const { sql, params } = compile({ ...NEXT_MATCH, division });

    // Both rosters are joined and both are tested, disjunctively. Attributing
    // by the home roster alone hid 2023-24 LoL's Midwood Varsity vs Midwood JV
    // fixture from the JV tab, while roster_standings had already counted the
    // JV side's result.
    expect(sql).toContain('"home_roster"."division"');
    expect(sql).toContain('"away_roster"."division"');
    expect(sql).toMatch(/home_roster"\."division".+ or .+away_roster"\."division"/s);

    // The division is compared as a parameter on both sides, never spliced in.
    expect(params.filter((p) => p === division)).toHaveLength(2);
  });

  it('normalizes the division in SQL, with the same JV set the TypeScript uses', () => {
    const { sql } = compile({ ...NEXT_MATCH, division: 'JV' });

    // Derived from `toHubDivision`, not hand-copied: if the two ever disagree
    // about which stored spellings mean JV, this fails.
    const jvSpellings = ['Varsity', 'JV', 'A', 'B', 'All', 'C', ''].filter(
      (value) => toHubDivision(value) === 'JV'
    );
    expect(jvSpellings).toEqual(['JV', 'B']);
    expect(sql).toContain(`in ('${jvSpellings.join("', '")}')`);
    // Everything else falls to Varsity rather than dropping out of both tabs.
    expect(sql).toContain("else 'Varsity' end");
  });

  it('never names a school it cannot render', () => {
    const { sql } = compile({ ...NEXT_MATCH, division: 'Varsity' });
    expect(sql).toContain('"home_school"."deleted_at" is null');
    expect(sql).toContain('"away_school"."deleted_at" is null');
  });
});

describe('buildHubMatchQuery — bounds and ordering', () => {
  it('asks for exactly the rows the tile renders', () => {
    // The old scan read 500 rows per status and filtered them in memory; the
    // cap covered both divisions at once, so a division's next match could
    // fall outside the window because the *other* division had more fixtures.
    expect(compile({ ...NEXT_MATCH, division: 'Varsity' }).params.at(-1)).toBe(1);
    expect(compile({ ...RECENT_RESULTS, division: 'Varsity' }).params.at(-1)).toBe(3);
    expect(compile({ ...NEXT_MATCH, division: 'Varsity' }).sql).toContain('limit');
  });

  it('breaks timestamp ties on id, in the same direction as the sort', () => {
    // Bulk-imported seasons default every unknown kickoff to one timestamp —
    // the active Valorant season has six matches sharing one — so without this
    // the LIMIT returns a different row between two identical requests.
    expect(compile({ ...NEXT_MATCH, division: 'Varsity' }).sql).toContain(
      'order by "matches"."scheduled_at" asc, "matches"."id" asc'
    );
    expect(compile({ ...RECENT_RESULTS, division: 'Varsity' }).sql).toContain(
      'order by "matches"."scheduled_at" desc, "matches"."id" desc'
    );
  });

  it('scopes every query to one season', () => {
    const { sql, params } = compile({ ...NEXT_MATCH, division: 'Varsity' });
    expect(sql).toContain('"matches"."season_id" = ');
    expect(params).toContain('season-1');
  });
});

describe('buildHubMatchQuery — the next match is in the future', () => {
  it('filters scheduled fixtures to on-or-after the given instant', () => {
    // Without this the hero tile happily advertises a fixture from months ago,
    // because a season whose schedule was never marked complete still has
    // `scheduled` rows in the past.
    const now = new Date('2026-07-25T12:00:00.000Z');
    const { sql, params } = compile({ ...NEXT_MATCH, division: 'Varsity' });
    expect(sql).toContain('"matches"."scheduled_at" >= ');
    // Drizzle binds a timestamp column's Date as its ISO string.
    expect(params).toContain(now.toISOString());
  });

  it('does not apply that filter to completed results', () => {
    // Results are necessarily in the past; reusing the constraint would empty
    // the tile.
    const { sql } = compile({ ...RECENT_RESULTS, division: 'Varsity' });
    expect(sql).not.toContain('"matches"."scheduled_at" >= ');
  });

  it('only reads results whose scores were actually recorded', () => {
    const { sql } = compile({ ...RECENT_RESULTS, division: 'Varsity' });
    expect(sql).toContain('"matches"."home_score" is not null');
    expect(sql).toContain('"matches"."away_score" is not null');
  });
});
