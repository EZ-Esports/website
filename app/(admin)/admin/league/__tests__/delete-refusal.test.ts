import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteGameInDb: vi.fn(),
  deleteSeasonInDb: vi.fn(),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: vi.fn(async () => ({})) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/db/queries', () => ({
  createGameInDb: vi.fn(),
  updateGameInDb: vi.fn(),
  deleteGameInDb: mocks.deleteGameInDb,
  createSeasonInDb: vi.fn(),
  updateSeasonInDb: vi.fn(),
  deleteSeasonInDb: mocks.deleteSeasonInDb,
}));
vi.mock('@/app/lib/db', () => ({ db: {} }));

import { deleteGame, deleteSeason } from '../actions';

/** What deleteGameInDb / deleteSeasonInDb throw when matches exist (`DeleteRefusedError`). */
const refusal = (message: string) => Object.assign(new Error(message), { name: 'DeleteRefusedError' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('deleting a game or season that has matches', () => {
  it('shows the real reason instead of a generic message', async () => {
    mocks.deleteGameInDb.mockRejectedValue(refusal('Cannot delete a game with existing matches. Please delete its matches first.'));
    expect(await deleteGame('g1')).toEqual({
      success: false,
      error: 'Cannot delete a game with existing matches. Please delete its matches first.',
    });

    mocks.deleteSeasonInDb.mockRejectedValue(refusal('Cannot delete season with existing matches. Please reassign or delete matches first.'));
    expect(await deleteSeason('s1')).toEqual({
      success: false,
      error: 'Cannot delete season with existing matches. Please reassign or delete matches first.',
    });
  });

  it('keeps the generic message for any other failure', async () => {
    mocks.deleteGameInDb.mockRejectedValue(new Error('connection reset'));
    const res = await deleteGame('g1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/may have active seasons or teams/);
    expect(res.error).not.toContain('connection reset');
  });

  it('still succeeds when nothing refuses', async () => {
    mocks.deleteGameInDb.mockResolvedValue(undefined);
    expect(await deleteGame('g1')).toEqual({ success: true });
  });
});
