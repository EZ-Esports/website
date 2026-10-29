import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  returned: [] as Array<{ id: string }>,
  txCalls: 0,
  fail: false,
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: vi.fn(async () => ({})) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/db', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      mocks.txCalls++;
      if (mocks.fail) throw new Error('boom');
      return fn({
        delete: () => ({
          where: () => ({ returning: async () => mocks.returned }),
        }),
      });
    },
  },
}));

import { updateTag } from 'next/cache';
import { requirePermission } from '@/app/lib/auth';
import { MAX_BULK_DELETE_MATCHES, deleteMatches } from '../actions';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('deleteMatches', () => {
  beforeEach(() => {
    mocks.txCalls = 0;
    mocks.fail = false;
    mocks.returned = [{ id: A }, { id: B }];
    vi.mocked(updateTag).mockClear();
    vi.mocked(requirePermission).mockClear();
  });

  it('requires the manage-matches permission', async () => {
    await deleteMatches([A]);
    expect(requirePermission).toHaveBeenCalled();
  });

  it('rejects empty, malformed and oversized input without touching the database', async () => {
    expect((await deleteMatches([])).success).toBe(false);
    expect((await deleteMatches([A, 'not-a-uuid'])).success).toBe(false);
    const many = Array.from(
      { length: MAX_BULK_DELETE_MATCHES + 1 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect((await deleteMatches(many)).success).toBe(false);
    expect(mocks.txCalls).toBe(0);
  });

  it('deletes in one transaction and invalidates the same tags as a single delete', async () => {
    const res = await deleteMatches([A, B, A]);
    expect(res).toEqual({ success: true, deleted: 2 });
    expect(mocks.txCalls).toBe(1);
    expect(vi.mocked(updateTag).mock.calls.map((c) => c[0])).toEqual(['matches', 'rosters', 'teams']);
  });

  it('returns an error and skips invalidation when the transaction fails', async () => {
    mocks.fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await deleteMatches([A]);
    expect(res.success).toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
