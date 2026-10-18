import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint) => ({})),
  updated: [] as Array<{ set: any }>,
  rowsReturned: [{ id: 's1' }] as Array<{ id: string }>,
  existing: [{ id: 's1' }] as Array<{ id: string }>,
  updateSeasonInDb: vi.fn(async (id: string, v: any) => ({ id, ...v })),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }));
vi.mock('@/app/lib/db/queries', () => ({
  createGameInDb: vi.fn(),
  updateGameInDb: vi.fn(),
  deleteGameInDb: vi.fn(),
  createSeasonInDb: vi.fn(),
  updateSeasonInDb: mocks.updateSeasonInDb,
  deleteSeasonInDb: vi.fn(),
}));
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.existing }) }) }),
    update: () => ({
      set: (set: any) => {
        mocks.updated.push({ set });
        return { where: () => ({ returning: async () => mocks.rowsReturned }) };
      },
    }),
  },
}));

import { lockSeasonRosters, unlockSeasonRosters, updateSeason } from '../actions';
import { Permissions } from '@/app/lib/roles';

describe('League Setup season roster lock actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updated.length = 0;
    mocks.rowsReturned = [{ id: 's1' }];
    mocks.existing = [{ id: 's1' }];
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  it('lock stamps rosters_locked_at and refreshes the seasons tag', async () => {
    const res = await lockSeasonRosters('s1');
    expect(res).toEqual({ success: true });
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_LEAGUE);
    expect(mocks.updated[0].set.rostersLockedAt).toBeInstanceOf(Date);
    expect(mocks.updateTag).toHaveBeenCalledWith('seasons');
  });

  it('unlock clears rosters_locked_at', async () => {
    const res = await unlockSeasonRosters('s1');
    expect(res).toEqual({ success: true });
    expect(mocks.updated[0].set.rostersLockedAt).toBeNull();
    expect(mocks.updateTag).toHaveBeenCalledWith('seasons');
  });

  it('both require MANAGE_LEAGUE and write nothing when denied', async () => {
    mocks.requirePermission.mockImplementation(async () => {
      throw new Error('Forbidden');
    });
    await expect(lockSeasonRosters('s1')).rejects.toThrow('Forbidden');
    await expect(unlockSeasonRosters('s1')).rejects.toThrow('Forbidden');
    expect(mocks.updated).toHaveLength(0);
  });

  it('reports an unknown season and a missing id with the standard shape', async () => {
    mocks.rowsReturned = [];
    mocks.existing = [];
    expect(await lockSeasonRosters('nope')).toEqual({ success: false, error: 'Season not found.' });
    expect(await unlockSeasonRosters('')).toEqual({ success: false, error: 'Season is required.' });
  });
  it('a repeat lock is an idempotent success (the guarded update matches nothing, the season exists)', async () => {
    mocks.rowsReturned = [];
    mocks.existing = [{ id: 's1' }];
    expect(await lockSeasonRosters('s1')).toEqual({ success: true });
  });

  it('unlock of a nonexistent season returns Season not found.', async () => {
    mocks.rowsReturned = [];
    mocks.existing = [];
    expect(await unlockSeasonRosters('nope')).toEqual({ success: false, error: 'Season not found.' });
  });

  it('updateSeason never passes the lock column on, so editing leaves the lock untouched', async () => {
    const fd = new FormData();
    fd.set('name', '2026-27');
    fd.set('isActive', 'true');
    await updateSeason('s1', fd);
    expect(mocks.updateSeasonInDb).toHaveBeenCalledTimes(1);
    expect(Object.keys(mocks.updateSeasonInDb.mock.calls[0][1])).not.toContain('rostersLockedAt');
    expect(mocks.updated).toHaveLength(0);
  });
});
