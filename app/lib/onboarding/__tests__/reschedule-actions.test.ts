import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A chainable stand-in for a drizzle query: every method returns the chain and awaiting it
// resolves the next queued result, so a test lists the reads/writes in the order the action makes.
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const inserted: unknown[][] = [];
  const updated: Record<string, unknown>[] = [];

  function chain(onSet?: (v: Record<string, unknown>) => void): any {
    const proxy: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = queue.shift();
          if (result instanceof Error) return (_ok: unknown, bad: (e: unknown) => void) => bad(result);
          return (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
        }
        if (prop === 'set') {
          return (v: Record<string, unknown>) => {
            updated.push(v);
            onSet?.(v);
            return proxy;
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  }

  const insertBuilder = () => ({
    values: (v: unknown) => {
      inserted.push(Array.isArray(v) ? v : [v]);
      return chain();
    },
  });

  const db = {
    select: () => chain(),
    update: () => chain(),
    insert: () => insertBuilder(),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ select: () => chain(), update: () => chain(), insert: () => insertBuilder() }),
  };

  return { queue, inserted, updated, db, assertManagerForSchoolGame: vi.fn() };
});

vi.mock('@/app/lib/db', () => ({ db: mocks.db }));
vi.mock('../manager-auth', () => ({ assertManagerForSchoolGame: mocks.assertManagerForSchoolGame }));

import {
  cancelReschedule,
  requestReschedule,
  respondToReschedule,
} from '../reschedule-actions';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const HOUR = 3600_000;
const MATCH_AT = new Date(NOW.getTime() + 10 * 24 * HOUR);

const match = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  seasonId: 'season-1',
  gameId: 'game-1',
  status: 'scheduled',
  scheduledAt: MATCH_AT,
  homeSchoolId: 'school-a',
  awaySchoolId: 'school-b',
  ...over,
});

const request = (over: Record<string, unknown> = {}) => ({
  id: 'req-1',
  matchId: 'm1',
  requestedBySchoolId: 'school-a',
  status: 'pending_opponent',
  originalScheduledAt: MATCH_AT,
  ...over,
});

// Eastern wall-clock proposals (November: EST, UTC-5), well inside the future and an hour apart.
const PROPOSALS = ['2026-11-12T19:00', '2026-11-13T19:00'];

function asManager(over: Record<string, unknown> = {}) {
  mocks.assertManagerForSchoolGame.mockResolvedValue({
    context: { userId: 'user-1', isStaffAdmin: false },
    season: { id: 'season-1' },
    ...over,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocks.queue.length = 0;
  mocks.inserted.length = 0;
  mocks.updated.length = 0;
  mocks.assertManagerForSchoolGame.mockReset();
  asManager();
});

afterEach(() => vi.useRealTimers());

describe('requestReschedule', () => {
  const params = { matchId: 'm1', schoolId: 'school-a', reason: 'Exam conflict', proposedTimes: PROPOSALS };

  it('needs a reason before touching the database', async () => {
    const result = await requestReschedule({ ...params, reason: '   ' });
    expect(result).toEqual({ success: false, error: 'Explain why the match needs to move.' });
    expect(mocks.assertManagerForSchoolGame).not.toHaveBeenCalled();
  });

  it('authorizes the school for the match game (a write, so view-only seasons are refused)', async () => {
    mocks.queue.push([match()], [{ id: 'req-1' }], []);
    await requestReschedule(params);
    expect(mocks.assertManagerForSchoolGame).toHaveBeenCalledWith('school-a', 'game-1');
  });

  it('propagates an authorization failure', async () => {
    mocks.queue.push([match()]);
    mocks.assertManagerForSchoolGame.mockRejectedValue(new Error('Forbidden: Not authorized for school school-a'));
    await expect(requestReschedule(params)).rejects.toThrow(/Forbidden/);
    expect(mocks.inserted).toEqual([]);
  });

  it('refuses a staff admin', async () => {
    mocks.queue.push([match()]);
    asManager({ context: { userId: 'staff', isStaffAdmin: true }, season: null });
    await expect(requestReschedule(params)).rejects.toThrow(/staff portal/);
  });

  it("refuses a match outside the manager's season", async () => {
    mocks.queue.push([match({ seasonId: 'season-2' })]);
    await expect(requestReschedule(params)).rejects.toThrow(/not in your season/);
  });

  it('refuses a school that is not playing in the match', async () => {
    mocks.queue.push([match()]);
    await expect(requestReschedule({ ...params, schoolId: 'school-z' })).rejects.toThrow(/not playing/);
  });

  it('leaves a match between two squads of one school to staff', async () => {
    mocks.queue.push([match({ awaySchoolId: 'school-a' })]);
    const result = await requestReschedule(params);
    expect(result.error).toMatch(/moved by staff/);
  });

  it('refuses a match that has started or is not scheduled', async () => {
    mocks.queue.push([match({ scheduledAt: new Date(NOW.getTime() - HOUR) })]);
    expect((await requestReschedule(params)).error).toMatch(/not started/);
    mocks.queue.push([match({ status: 'live' })]);
    expect((await requestReschedule(params)).error).toMatch(/not started/);
  });

  it('enforces two proposed times at least an hour apart', async () => {
    mocks.queue.push([match()]);
    expect((await requestReschedule({ ...params, proposedTimes: [PROPOSALS[0]] })).error).toMatch(/at least 2/);
    mocks.queue.push([match()]);
    const tooClose = await requestReschedule({
      ...params,
      proposedTimes: ['2026-11-12T19:00', '2026-11-12T19:30'],
    });
    expect(tooClose.error).toMatch(/one hour apart/);
    expect(mocks.inserted).toEqual([]);
  });

  it('stores the request and its options, as on time when 72+ hours ahead', async () => {
    mocks.queue.push([match()], [{ id: 'req-1' }], []);
    expect(await requestReschedule(params)).toEqual({ success: true });
    const [[requestRow], options] = mocks.inserted as [Record<string, unknown>[], Record<string, unknown>[]];
    expect(requestRow).toMatchObject({
      matchId: 'm1',
      requestedBySchoolId: 'school-a',
      requestedByUserId: 'user-1',
      reason: 'Exam conflict',
      isLate: false,
      originalScheduledAt: MATCH_AT,
    });
    expect(options).toHaveLength(2);
    // 19:00 ET on 12 Nov (EST) is 00:00 UTC on 13 Nov.
    expect(options[0]).toMatchObject({ requestId: 'req-1', proposedAt: new Date('2026-11-13T00:00:00.000Z') });
  });

  it('flags a request under 72 hours as late', async () => {
    mocks.queue.push([match({ scheduledAt: new Date(NOW.getTime() + 48 * HOUR) })], [{ id: 'req-1' }], []);
    await requestReschedule({ ...params, proposedTimes: ['2026-10-28T19:00', '2026-10-29T19:00'] });
    expect(mocks.inserted[0][0]).toMatchObject({ isLate: true });
  });

  it('reports an already-open request instead of failing', async () => {
    mocks.queue.push([match()], Object.assign(new Error('duplicate key'), { code: '23505' }));
    const result = await requestReschedule(params);
    expect(result).toEqual({ success: false, error: 'This match already has an open reschedule request.' });
  });
});

describe('respondToReschedule', () => {
  const accept = { requestId: 'req-1', schoolId: 'school-b', accept: true, optionId: 'opt-1' };
  const option = (over: Record<string, unknown> = {}) => ({
    id: 'opt-1',
    requestId: 'req-1',
    proposedAt: new Date(NOW.getTime() + 11 * 24 * HOUR),
    ...over,
  });

  it('refuses the requesting school answering its own request', async () => {
    mocks.queue.push([request()], [match()]);
    const result = await respondToReschedule({ ...accept, schoolId: 'school-a' });
    expect(result.error).toMatch(/other school has to answer/);
  });

  it('refuses a request that is no longer waiting for the opponent', async () => {
    mocks.queue.push([request({ status: 'pending_staff' })], [match()]);
    expect((await respondToReschedule(accept)).error).toMatch(/no longer waiting/);
  });

  it('refuses once the match has been moved since the request', async () => {
    mocks.queue.push([request()], [match({ scheduledAt: new Date(MATCH_AT.getTime() + HOUR) })]);
    expect((await respondToReschedule(accept)).error).toMatch(/changed since/);
  });

  it('declines without needing an option', async () => {
    mocks.queue.push([request()], [match()], [{ id: 'req-1' }]);
    const result = await respondToReschedule({ requestId: 'req-1', schoolId: 'school-b', accept: false });
    expect(result).toEqual({ success: true });
    expect(mocks.updated[0]).toMatchObject({ status: 'declined_opponent', opponentRespondedByUserId: 'user-1' });
  });

  it('requires an option to accept, and one that belongs to the request', async () => {
    mocks.queue.push([request()], [match()]);
    expect((await respondToReschedule({ ...accept, optionId: undefined })).error).toMatch(/Choose one/);
    mocks.queue.push([request()], [match()], []);
    expect((await respondToReschedule(accept)).error).toMatch(/not part of this request/);
  });

  it('refuses a proposed time that has already passed', async () => {
    mocks.queue.push([request()], [match()], [option({ proposedAt: new Date(NOW.getTime() - HOUR) })]);
    expect((await respondToReschedule(accept)).error).toMatch(/already passed/);
  });

  it('moves an accepted request on to staff and records the chosen time', async () => {
    mocks.queue.push([request()], [match()], [option()], [{ id: 'req-1' }]);
    expect(await respondToReschedule(accept)).toEqual({ success: true });
    expect(mocks.updated[0]).toMatchObject({ status: 'pending_staff', acceptedOptionId: 'opt-1' });
  });

  it('loses gracefully when the request resolved in the meantime', async () => {
    mocks.queue.push([request()], [match()], [option()], []);
    expect((await respondToReschedule(accept)).error).toMatch(/already resolved/);
  });
});

describe('cancelReschedule', () => {
  const cancel = { requestId: 'req-1', schoolId: 'school-a' };

  it('lets the requester cancel while the opponent has not answered', async () => {
    mocks.queue.push([request()], [match()], [{ id: 'req-1' }]);
    expect(await cancelReschedule(cancel)).toEqual({ success: true });
    expect(mocks.updated[0]).toEqual({ status: 'cancelled' });
  });

  it('refuses the opposing school', async () => {
    mocks.queue.push([request()], [match()]);
    const result = await cancelReschedule({ ...cancel, schoolId: 'school-b' });
    expect(result.error).toMatch(/Only the school that made/);
  });

  it('refuses once the opponent agreed, before touching the row', async () => {
    mocks.queue.push([request({ status: 'pending_staff' })], [match()]);
    expect((await cancelReschedule(cancel)).error).toMatch(/already agreed/);
    expect(mocks.updated).toEqual([]);
  });

  it('refuses when the opponent agreed between the read and the write', async () => {
    mocks.queue.push([request()], [match()], []);
    expect((await cancelReschedule(cancel)).error).toMatch(/already agreed/);
  });
});
