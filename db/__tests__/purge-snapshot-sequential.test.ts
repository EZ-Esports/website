import { describe, it, expect } from 'vitest';
import { loadSnapshotFrom, type SqlLike } from '../purge-onboarding-test-data';

/**
 * Regression: the purge script's first real dry run against production hung forever. It read ~20
 * tables with Promise.all over ONE connection; postgres.js pipelines those, and the Supabase
 * transaction pooler (port 6543) never answers a pipelined batch (single queries return in ms, four
 * at once never come back). The in-memory PGlite rehearsal cannot reproduce a pooler, so this
 * asserts the property that matters: the snapshot never has two queries in flight at once.
 */
describe('loadSnapshotFrom', () => {
  it('runs its read queries strictly one at a time (never pipelined)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const sql: SqlLike = {
      unsafe: async () => {
        calls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // Yield so an implementation that fires queries together would overlap here.
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        const rows = [] as unknown as Record<string, unknown>[] & { count: number };
        rows.count = 0;
        return rows;
      },
    };

    const snapshot = await loadSnapshotFrom(sql);

    expect(calls).toBeGreaterThanOrEqual(20);
    expect(maxInFlight).toBe(1);
    expect(snapshot.members).toEqual([]);
  });
});
