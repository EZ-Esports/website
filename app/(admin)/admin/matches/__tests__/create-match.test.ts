import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rosterRows: [] as Array<{ rosterId: string; seasonId: string; gameId: string; division: string }>,
  inserts: [] as unknown[],
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: vi.fn(async () => ({})) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: async () => mocks.rosterRows }) }),
    }),
    insert: () => ({
      values: async (v: unknown) => {
        mocks.inserts.push(v);
      },
    }),
  },
}));

import { createMatch } from '../actions';

const SEASON = 's1';
const row = (rosterId: string, division: string, over: Partial<(typeof mocks.rosterRows)[number]> = {}) => ({
  rosterId,
  seasonId: SEASON,
  gameId: 'g1',
  division,
  ...over,
});

function form(home = 'r1', away = 'r2') {
  const fd = new FormData();
  fd.set('seasonId', SEASON);
  fd.set('homeRosterId', home);
  fd.set('awayRosterId', away);
  fd.set('scheduledAt', '2026-10-30T19:00');
  return fd;
}

describe('createMatch division rule', () => {
  beforeEach(() => {
    mocks.inserts.length = 0;
  });

  it('refuses a Varsity roster against a JV roster', async () => {
    mocks.rosterRows = [row('r1', 'Varsity'), row('r2', 'JV')];
    const res = await createMatch(form());
    expect(res).toEqual({ success: false, error: 'Both rosters must be in the same division.' });
    expect(mocks.inserts).toHaveLength(0);
  });

  it('treats stored A/B and Varsity/JV spellings as the same divisions', async () => {
    mocks.rosterRows = [row('r1', 'A'), row('r2', 'Varsity')];
    expect(await createMatch(form())).toEqual({ success: true });
    mocks.rosterRows = [row('r1', 'B'), row('r2', 'JV')];
    expect(await createMatch(form())).toEqual({ success: true });
    expect(mocks.inserts).toHaveLength(2);
  });

  it('still refuses a mismatched season before looking at divisions', async () => {
    mocks.rosterRows = [row('r1', 'Varsity'), row('r2', 'Varsity', { seasonId: 'other' })];
    const res = await createMatch(form());
    expect(res.success).toBe(false);
    expect(res.error).toContain('selected season');
  });
});
