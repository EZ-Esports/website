import { describe, expect, it, vi } from 'vitest';
import * as schema from '@/app/lib/db/schema';

vi.mock('@/app/lib/db', () => ({ db: {} }));

import { ensurePlayerSubmission } from '../onboarding';

type Row = Record<string, unknown>;

/** A transaction stand-in: reads return the rows registered for the table, inserts are recorded. */
function fakeTx(rows: { seasons: Row[]; invites: Row[] }) {
  const inserted: Row[] = [];
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === schema.seasons ? rows.seasons : rows.invites),
      }),
    }),
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

describe('ensurePlayerSubmission season stamping (spec-045)', () => {
  it('stamps the season named by the manager affiliation, even when it is not the active one', async () => {
    const { tx, inserted } = fakeTx({ seasons, invites: [] });
    expect(await ensurePlayerSubmission(tx, { ...base, seasonName: '2027-28' })).toBe(true);
    expect(inserted[0]).toMatchObject({ seasonId: 'next', status: 'submitted' });
  });

  it('falls back to the active season when no season has that name', async () => {
    const { tx, inserted } = fakeTx({ seasons, invites: [] });
    await ensurePlayerSubmission(tx, { ...base, seasonName: '2031-32' });
    expect(inserted[0]).toMatchObject({ seasonId: 'now' });
  });

  it('stores no season when the game has none', async () => {
    const { tx, inserted } = fakeTx({ seasons: [], invites: [] });
    await ensurePlayerSubmission(tx, { ...base, seasonName: '2026-27' });
    expect(inserted[0]).toMatchObject({ seasonId: null });
  });

  it('only a live application of the SAME season blocks a new one', async () => {
    const live = [{ id: 'i1', status: 'submitted', seasonId: 'past' }];
    const a = fakeTx({ seasons, invites: live });
    expect(await ensurePlayerSubmission(a.tx, { ...base, seasonName: '2026-27' })).toBe(true);
    const b = fakeTx({ seasons, invites: live });
    expect(await ensurePlayerSubmission(b.tx, { ...base, seasonName: '2025-26' })).toBe(false);
    expect(b.inserted).toHaveLength(0);
    const c = fakeTx({ seasons, invites: [{ id: 'i2', status: 'rejected', seasonId: 'now' }] });
    expect(await ensurePlayerSubmission(c.tx, { ...base, seasonName: '2026-27' })).toBe(true);
  });
});
