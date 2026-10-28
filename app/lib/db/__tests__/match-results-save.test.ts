import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  locked: vi.fn(),
  writes: vi.fn(),
}));

// The transaction callback gets a tx whose select().from().where().for() yields the locked match row
// and whose other statements are recorded, so the test sees whether anything was written.
vi.mock('@/app/lib/db', () => {
  const selectChain = (rows: () => unknown) => {
    const chain: Record<string, unknown> = {};
    for (const name of ['from', 'where', 'innerJoin']) chain[name] = () => chain;
    chain.for = () => rows();
    chain.then = (resolve: (v: unknown) => void) => resolve(rows());
    return chain;
  };
  const tx = {
    select: () => selectChain(() => mocks.locked()),
    delete: () => ({ where: () => mocks.writes('delete') }),
    insert: () => ({ values: () => mocks.writes('insert') }),
    update: () => ({ set: () => ({ where: () => mocks.writes('update') }) }),
  };
  return { db: { transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
});

import { saveSeriesResult } from '../match-results';

const series = {
  homeWins: 2,
  awayWins: 0,
  winner: 'home' as const,
  games: [
    { matchId: 'r1', gameNumber: 1, startedAt: new Date(), homeSide: 'Red' as const, homeRounds: 13, awayRounds: 5, winner: 'home' as const, unrostered: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveSeriesResult', () => {
  it.each([
    ['already completed', { status: 'completed', homeScore: 2 }],
    ['already scored', { status: 'scheduled', homeScore: 1 }],
    ['cancelled', { status: 'cancelled', homeScore: null }],
    ['forfeit', { status: 'forfeit', homeScore: null }],
  ])('refuses and writes nothing when the locked match is %s', async (_label, row) => {
    mocks.locked.mockReturnValue([row]);
    expect(await saveSeriesResult({ matchId: 'm1', series })).toBe(false);
    expect(mocks.writes).not.toHaveBeenCalled();
  });

  it('refuses a match that no longer exists', async () => {
    mocks.locked.mockReturnValue([]);
    expect(await saveSeriesResult({ matchId: 'm1', series })).toBe(false);
  });
});
