import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('@/app/lib/db/index', () => ({ db: {} }));

import { lockRoster, lockRosterMember, memberOnRoster, rosterPlayerRoles, siblingEnrollment } from '../roster-scope';

/**
 * A stand-in executor that records each query's table and WHERE clause and answers from a queue,
 * so the tests can assert the filters the helpers build, not just what they return.
 */
function fakeExecutor(answers: unknown[][]) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const dialect = new PgDialect();
  const executor = {
    select: () => ({
      from: () => ({
        where: (clause: never) => {
          queries.push(dialect.sqlToQuery(clause));
          const rows = answers.shift() ?? [];
          return Object.assign(Promise.resolve(rows), { limit: async () => rows });
        },
      }),
    }),
    execute: async (query: never) => {
      executed.push(dialect.sqlToQuery(query));
      return [];
    },
  };
  return { executor: executor as never, queries, executed };
}

describe('siblingEnrollment', () => {
  it('scopes the roster lookup to the team and the player lookup to the member', async () => {
    const { executor, queries } = fakeExecutor([[{ id: 'r-jv', name: 'JV' }], []]);
    await siblingEnrollment('team-1', 'member-1', 'r-varsity', executor);

    expect(queries[0].sql).toContain('"team_id" = $1');
    expect(queries[0].params).toEqual(['team-1']);
    expect(queries[1].sql).toContain('"member_id" = $1');
    expect(queries[1].params).toEqual(['member-1']);
  });

  it('returns the sibling roster the member is on', async () => {
    const { executor } = fakeExecutor([
      [
        { id: 'r-varsity', name: 'Varsity' },
        { id: 'r-jv', name: 'JV' },
      ],
      [{ id: 'p1', rosterId: 'r-jv' }],
    ]);
    await expect(siblingEnrollment('team-1', 'member-1', 'r-varsity', executor)).resolves.toEqual({
      playerId: 'p1',
      rosterId: 'r-jv',
      rosterName: 'JV',
    });
  });

  it('excludes the roster being enrolled onto: a row there is not a sibling', async () => {
    const { executor } = fakeExecutor([
      [
        { id: 'r-varsity', name: 'Varsity' },
        { id: 'r-jv', name: 'JV' },
      ],
      [{ id: 'p1', rosterId: 'r-varsity' }],
    ]);
    await expect(siblingEnrollment('team-1', 'member-1', 'r-varsity', executor)).resolves.toBeNull();
  });

  it('ignores rows on rosters of other teams (a different game is allowed)', async () => {
    const { executor } = fakeExecutor([
      [
        { id: 'r-varsity', name: 'Varsity' },
        { id: 'r-jv', name: 'JV' },
      ],
      [{ id: 'p-other-game', rosterId: 'r-lol-varsity' }],
    ]);
    await expect(siblingEnrollment('team-1', 'member-1', 'r-varsity', executor)).resolves.toBeNull();
  });

  it('skips the player lookup when the team has no other roster', async () => {
    const { executor, queries } = fakeExecutor([[{ id: 'r-varsity', name: 'Varsity' }]]);
    await expect(siblingEnrollment('team-1', 'member-1', 'r-varsity', executor)).resolves.toBeNull();
    expect(queries).toHaveLength(1);
  });
});

describe('memberOnRoster', () => {
  it('filters on both the roster and the member', async () => {
    const { executor, queries } = fakeExecutor([[{ id: 'p1' }]]);
    await expect(memberOnRoster('member-1', 'r-jv', executor)).resolves.toBe(true);
    expect(queries[0].sql).toContain('"roster_id" = $1');
    expect(queries[0].sql).toContain('"member_id" = $2');
    expect(queries[0].params).toEqual(['r-jv', 'member-1']);
  });

  it('is false when there is no row', async () => {
    const { executor } = fakeExecutor([[]]);
    await expect(memberOnRoster('member-1', 'r-jv', executor)).resolves.toBe(false);
  });
});

describe('lockRosterMember', () => {
  it('takes a transaction-scoped advisory lock keyed on the team and the member', async () => {
    const { executor, executed } = fakeExecutor([]);
    await lockRosterMember(executor, 'team-1', 'member-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('pg_advisory_xact_lock');
    expect(executed[0].params).toEqual(['roster-member:team-1:member-1']);
  });

  it('uses different keys for different members of one team', async () => {
    const { executor, executed } = fakeExecutor([]);
    await lockRosterMember(executor, 'team-1', 'member-1');
    await lockRosterMember(executor, 'team-1', 'member-2');
    expect(executed[0].params).not.toEqual(executed[1].params);
  });
});

describe('lockRoster and rosterPlayerRoles', () => {
  it('lockRoster takes an advisory lock keyed on the roster, distinct from the member lock key', async () => {
    const { executor, executed } = fakeExecutor([]);
    await lockRoster(executor, 'roster-1');
    await lockRosterMember(executor, 'team-1', 'member-1');
    expect(executed[0].sql).toContain('pg_advisory_xact_lock');
    expect(executed[0].params).toEqual(['roster:roster-1']);
    expect(executed[0].params).not.toEqual(executed[1].params);
  });

  it('rosterPlayerRoles reads the roster\'s players by roster id', async () => {
    const { executor, queries } = fakeExecutor([[{ id: 'p1', role: 'sub' }]]);
    await expect(rosterPlayerRoles(executor, 'roster-1')).resolves.toEqual([{ id: 'p1', role: 'sub' }]);
    expect(queries[0].sql).toContain('"roster_id" = $1');
    expect(queries[0].params).toEqual(['roster-1']);
  });
});
