import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Awaiting a query chain resolves the next queued result (see the manager action test).
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const updated: Record<string, unknown>[] = [];

  function chain(): any {
    const proxy: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = queue.shift();
          return (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
        }
        if (prop === 'set') {
          return (v: Record<string, unknown>) => {
            updated.push(v);
            return proxy;
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  }

  const tx = { select: () => chain(), update: () => chain() };
  const db = {
    update: () => chain(),
    transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return {
    queue,
    updated,
    db,
    requirePermission: vi.fn(),
    updateTag: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock('@/app/lib/db', () => ({ db: mocks.db }));
vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));

import { approveReschedule, declineReschedule } from '../reschedule-actions';
import { Permissions } from '@/app/lib/roles';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const HOUR = 3600_000;
const ORIGINAL = new Date(NOW.getTime() + 10 * 24 * HOUR);

const request = (over: Record<string, unknown> = {}) => ({
  id: 'req-1',
  matchId: 'm1',
  status: 'pending_staff',
  acceptedOptionId: 'opt-1',
  originalScheduledAt: ORIGINAL,
  ...over,
});
const option = (over: Record<string, unknown> = {}) => ({
  id: 'opt-1',
  proposedAt: new Date(NOW.getTime() + 11 * 24 * HOUR),
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocks.queue.length = 0;
  mocks.updated.length = 0;
  mocks.updateTag.mockClear();
  mocks.revalidatePath.mockClear();
  mocks.requirePermission.mockReset();
  mocks.requirePermission.mockResolvedValue({ id: 'staff-1' });
});

afterEach(() => vi.useRealTimers());

describe('approveReschedule', () => {
  it('requires the manage-matches permission', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(approveReschedule('req-1')).rejects.toThrow('Forbidden');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_MATCHES);
    expect(mocks.updated).toEqual([]);
  });

  it('moves the match to the accepted time, closes the request, and refreshes the schedule caches', async () => {
    mocks.queue.push([request()], [option()], [{ id: 'm1' }], []);
    expect(await approveReschedule('req-1', '  Fine by us  ')).toEqual({ success: true });

    expect(mocks.updated[0]).toEqual({ scheduledAt: option().proposedAt });
    expect(mocks.updated[1]).toMatchObject({
      status: 'approved',
      decidedByStaffId: 'staff-1',
      staffNote: 'Fine by us',
    });
    expect(mocks.updateTag).toHaveBeenCalledWith('matches');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/matches');
  });

  it('refuses a request that is not waiting on staff', async () => {
    mocks.queue.push([request({ status: 'pending_opponent' })]);
    expect((await approveReschedule('req-1')).error).toMatch(/no longer waiting/);
    mocks.queue.push([]);
    expect((await approveReschedule('missing')).error).toMatch(/no longer waiting/);
    expect(mocks.updated).toEqual([]);
  });

  it('refuses when the accepted time has already passed', async () => {
    mocks.queue.push([request()], [option({ proposedAt: new Date(NOW.getTime() - HOUR) })]);
    expect((await approveReschedule('req-1')).error).toMatch(/already passed/);
    expect(mocks.updated).toEqual([]);
  });

  it('refuses, without closing the request, when the match changed since the request', async () => {
    mocks.queue.push([request()], [option()], []);
    expect((await approveReschedule('req-1')).error).toMatch(/changed since/);
    expect(mocks.updated).toHaveLength(1);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});

describe('declineReschedule', () => {
  it('requires the manage-matches permission', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('Forbidden'));
    await expect(declineReschedule('req-1', 'No')).rejects.toThrow('Forbidden');
  });

  it('needs a note so the managers know why', async () => {
    expect(await declineReschedule('req-1', '   ')).toEqual({
      success: false,
      error: 'Add a note so the managers know why.',
    });
    expect(mocks.updated).toEqual([]);
  });

  it('records the decline and leaves the match alone', async () => {
    mocks.queue.push([{ id: 'req-1' }]);
    expect(await declineReschedule('req-1', 'Outside the season window')).toEqual({ success: true });
    expect(mocks.updated).toEqual([
      expect.objectContaining({
        status: 'declined_staff',
        decidedByStaffId: 'staff-1',
        staffNote: 'Outside the season window',
      }),
    ]);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('reports a request that was resolved in the meantime', async () => {
    mocks.queue.push([]);
    expect((await declineReschedule('req-1', 'No')).error).toMatch(/no longer waiting/);
  });
});
