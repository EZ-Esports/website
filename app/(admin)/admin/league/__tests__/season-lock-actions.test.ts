import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint) => ({})),
  updated: [] as Array<{ set: any }>,
  rowsReturned: [{ id: 's1' }] as Array<{ id: string }>,
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
  updateSeasonInDb: vi.fn(),
  deleteSeasonInDb: vi.fn(),
}));
vi.mock('@/app/lib/db', () => ({
  db: {
    update: () => ({
      set: (set: any) => {
        mocks.updated.push({ set });
        return { where: () => ({ returning: async () => mocks.rowsReturned }) };
      },
    }),
  },
}));

import { lockSeasonRosters, unlockSeasonRosters } from '../actions';
import { Permissions } from '@/app/lib/roles';

describe('League Setup season roster lock actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updated.length = 0;
    mocks.rowsReturned = [{ id: 's1' }];
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
    expect(await lockSeasonRosters('nope')).toEqual({ success: false, error: 'Season not found.' });
    expect(await unlockSeasonRosters('')).toEqual({ success: false, error: 'Season is required.' });
  });
});
