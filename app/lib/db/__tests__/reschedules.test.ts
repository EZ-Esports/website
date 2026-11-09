import { describe, it, expect, vi, beforeEach } from 'vitest';

// Awaiting a query chain resolves the next queued result; `where` conditions are captured so the
// test can see what the read filtered by.
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const wheres: unknown[] = [];
  function chain(): any {
    const proxy: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = queue.shift();
          return (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
        }
        if (prop === 'where') {
          return (condition: unknown) => {
            wheres.push(condition);
            return proxy;
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  }
  function paramValues(node: any): unknown[] {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node.queryChunks)) return node.queryChunks.flatMap(paramValues);
    if ('encoder' in node && 'value' in node) return [node.value];
    return [];
  }
  return { queue, wheres, paramValues, db: { select: () => chain() } };
});

vi.mock('server-only', () => ({}));
vi.mock('../index', () => ({ db: mocks.db }));

import { getRescheduledFrom } from '../reschedules';

describe('getRescheduledFrom', () => {
  beforeEach(() => {
    mocks.queue.length = 0;
    mocks.wheres.length = 0;
  });

  it('does not query when there are no matches', async () => {
    expect(await getRescheduledFrom([])).toEqual(new Map());
    expect(mocks.wheres).toEqual([]);
  });

  it('reads approved requests only', async () => {
    mocks.queue.push([]);
    await getRescheduledFrom(['m1']);
    const bound = mocks.wheres.flatMap(mocks.paramValues);
    expect(bound).toContain('approved');
    expect(bound).not.toContain('pending_staff');
  });

  it('keeps the first row per match, which the query orders newest decision first', async () => {
    mocks.queue.push([
      { matchId: 'm1', originalScheduledAt: new Date('2026-11-09T22:00:00.000Z') }, // moved most recently
      { matchId: 'm1', originalScheduledAt: new Date('2026-11-02T22:00:00.000Z') }, // an earlier move
      { matchId: 'm2', originalScheduledAt: new Date('2026-11-05T22:00:00.000Z') },
    ]);
    const from = await getRescheduledFrom(['m1', 'm2', 'm3']);
    expect(from.get('m1')).toBe('2026-11-09T22:00:00.000Z');
    expect(from.get('m2')).toBe('2026-11-05T22:00:00.000Z');
    expect(from.has('m3')).toBe(false);
  });
});
