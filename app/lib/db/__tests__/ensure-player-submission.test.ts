import { describe, expect, it, vi } from 'vitest';
import * as schema from '@/app/lib/db/schema';

vi.mock('@/app/lib/db', () => ({ db: {} }));

import { ensurePlayerSubmission } from '../onboarding';

type Row = Record<string, unknown>;
interface World {
  seasons: Row[];
  invites: Row[];
  /** The manager's active `school_managers` rows at the school. */
  managerRows: Row[];
}

/** A transaction stand-in: reads return the rows registered for the table, inserts are recorded. */
function fakeTx(world: World) {
  const inserted: Row[] = [];
  const rowsFor = (table: unknown): Row[] =>
    table === schema.seasons
      ? world.seasons
      : table === schema.games
        ? [{ id: 'g1', slug: 'valorant' }]
        : table === schema.schoolManagers
          ? world.managerRows
          : world.invites;
  const tx = {
    select: () => ({ from: (table: unknown) => ({ where: async () => rowsFor(table) }) }),
    insert: () => ({
      values: async (v: Row) => {
        inserted.push(v);
      },
    }),
  };
  return { tx: tx as never, inserted };
}

const base = {
  memberId: 'm1',
  schoolId: 's1',
  gameId: 'g1',
  invitedByUserId: 'u1',
  intendedFirstName: 'A',
  intendedLastName: 'B',
  tokenHash: 'h',
};
const seasons = [
  { id: 'past', name: '2025-26', isActive: false },
  { id: 'now', name: '2026-27', isActive: true },
  { id: 'next', name: '2027-28', isActive: false },
];
const row = (academicYear: string, managedGames: string[] | null = null) => ({ academicYear, managedGames });

describe('ensurePlayerSubmission season (spec-047)', () => {
  it("uses the manager's own resolved season, even when it is not the active one", async () => {
    const { tx, inserted } = fakeTx({ seasons, invites: [], managerRows: [row('2027-28')] });
    expect(await ensurePlayerSubmission(tx, base)).toBe(true);
    expect(inserted[0]).toMatchObject({ seasonId: 'next', status: 'submitted' });
  });

  it('follows the portal rule when the manager has several rows: the newest matching season wins, and a row for another game is ignored', async () => {
    const { tx, inserted } = fakeTx({
      seasons,
      invites: [],
      managerRows: [row('2025-26'), row('2026-27'), row('2027-28', ['league-of-legends'])],
    });
    await ensurePlayerSubmission(tx, base);
    expect(inserted[0]).toMatchObject({ seasonId: 'now' });
  });

  it('falls back to the active season when no season matches the manager rows', async () => {
    const { tx, inserted } = fakeTx({ seasons, invites: [], managerRows: [row('2031-32')] });
    await ensurePlayerSubmission(tx, base);
    expect(inserted[0]).toMatchObject({ seasonId: 'now' });
  });

  it('stores no season when the game has none', async () => {
    const { tx, inserted } = fakeTx({ seasons: [], invites: [], managerRows: [row('2026-27')] });
    await ensurePlayerSubmission(tx, base);
    expect(inserted[0]).toMatchObject({ seasonId: null });
  });

  it('only a live application of the SAME season blocks a new one', async () => {
    const live = [{ id: 'i1', status: 'submitted', seasonId: 'past' }];
    const a = fakeTx({ seasons, invites: live, managerRows: [row('2026-27')] });
    expect(await ensurePlayerSubmission(a.tx, base)).toBe(true);
    const b = fakeTx({ seasons, invites: live, managerRows: [row('2025-26')] });
    expect(await ensurePlayerSubmission(b.tx, base)).toBe(false);
    expect(b.inserted).toHaveLength(0);
    const c = fakeTx({ seasons, invites: [{ id: 'i2', status: 'rejected', seasonId: 'now' }], managerRows: [row('2026-27')] });
    expect(await ensurePlayerSubmission(c.tx, base)).toBe(true);
  });
});
