import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint) => ({})),
  updated: [] as Array<{ set: any }>,
  rowsReturned: [{ id: 's1' }] as Array<{ id: string }>,
  existing: [{ id: 's1' }] as Array<{ id: string }>,
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
  updateSeasonInDb: vi.fn(async (id: string, v: any) => ({ id, ...v })),
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

import { publishSeasonOutcomes, hideSeasonOutcomes } from '../actions';
import { Permissions } from '@/app/lib/roles';

describe('League Setup season outcome publication actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updated.length = 0;
    mocks.rowsReturned = [{ id: 's1' }];
    mocks.existing = [{ id: 's1' }];
    mocks.requirePermission.mockImplementation(async () => ({}));
  });

  it('publish stamps outcomes_finalized_at and refreshes every public tag', async () => {
    expect(await publishSeasonOutcomes('s1')).toEqual({ success: true });
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_LEAGUE);
    expect(mocks.updated[0].set.outcomesFinalizedAt).toBeInstanceOf(Date);
    for (const tag of ['seasons', 'matches', 'teams', 'rosters']) {
      expect(mocks.updateTag).toHaveBeenCalledWith(tag);
    }
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[game]/standings', 'page');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[game]/schedule', 'page');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/archives');
  });

  it('hide clears outcomes_finalized_at', async () => {
    expect(await hideSeasonOutcomes('s1')).toEqual({ success: true });
    expect(mocks.updated[0].set.outcomesFinalizedAt).toBeNull();
    expect(mocks.updateTag).toHaveBeenCalledWith('seasons');
  });

  it('both require MANAGE_LEAGUE and write nothing when denied', async () => {
    mocks.requirePermission.mockImplementation(async () => {
      throw new Error('Forbidden');
    });
    await expect(publishSeasonOutcomes('s1')).rejects.toThrow('Forbidden');
    await expect(hideSeasonOutcomes('s1')).rejects.toThrow('Forbidden');
    expect(mocks.updated).toHaveLength(0);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('reports a missing id and an unknown season; a repeat publish is an idempotent success', async () => {
    expect(await publishSeasonOutcomes('')).toEqual({ success: false, error: 'Season is required.' });
    mocks.rowsReturned = [];
    mocks.existing = [];
    expect(await hideSeasonOutcomes('nope')).toEqual({ success: false, error: 'Season not found.' });
    mocks.existing = [{ id: 's1' }];
    expect(await publishSeasonOutcomes('s1')).toEqual({ success: true });
  });
});
