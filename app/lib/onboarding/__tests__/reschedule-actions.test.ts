import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A chainable stand-in for a drizzle query: every method returns the chain and awaiting it
// resolves the next queued result, so a test lists the reads/writes in the order the action makes.
const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const inserted: unknown[][] = [];
  const updated: Record<string, unknown>[] = [];
  // Every `where` condition passed to a query, in order, so a test can assert on the SQL
  // parameters the action filtered by (the stand-in cannot run SQL, but it can see its inputs).
  const wheres: unknown[] = [];

  function chain(onSet?: (v: Record<string, unknown>) => void): any {
    const proxy: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = queue.shift();
          if (result instanceof Error) return (_ok: unknown, bad: (e: unknown) => void) => bad(result);
          return (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
        }
        if (prop === 'where') {
          return (condition: unknown) => {
            wheres.push(condition);
            return proxy;
          };
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

  /** The literal values bound as parameters anywhere inside a drizzle condition. */
  function paramValues(node: any): unknown[] {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node.queryChunks)) return node.queryChunks.flatMap(paramValues);
    if ('encoder' in node && 'value' in node) return [node.value];
    return [];
  }

  return { queue, inserted, updated, wheres, paramValues, db,
    assertManagerForSchoolGame: vi.fn(),
    updateTag: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock('@/app/lib/db', () => ({ db: mocks.db }));
vi.mock('next/cache', () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));
vi.mock('../manager-auth', () => ({ assertManagerForSchoolGame: mocks.assertManagerForSchoolGame }));

import { MAX_RESCHEDULE_REQUESTS_PER_SEASON } from '@/app/lib/reschedule-rules';
import {
  cancelReschedule,
  counterReschedule,
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
  mocks.wheres.length = 0;
  mocks.assertManagerForSchoolGame.mockReset();
  mocks.updateTag.mockReset();
  mocks.revalidatePath.mockReset();
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

  it('returns an authorization failure with its message (thrown messages are redacted in production)', async () => {
    mocks.queue.push([match()]);
    mocks.assertManagerForSchoolGame.mockRejectedValue(
      new Error('Season 2026-27 is view only.')
    );
    expect(await requestReschedule(params)).toEqual({ success: false, error: 'Season 2026-27 is view only.' });
    expect(mocks.inserted).toEqual([]);
  });

  describe('as a staff admin acting as the viewed school (spec-054)', () => {
    const asStaff = () => asManager({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });

    it('requests as the viewed school, recording the staff user, with no season match needed', async () => {
      asStaff();
      mocks.queue.push([match({ seasonId: 'any-season' })], [], [{ used: 0 }], [{ id: 'req-1' }], []);
      expect(await requestReschedule(params)).toEqual({ success: true });
      expect(mocks.inserted[0][0]).toMatchObject({ requestedBySchoolId: 'school-a', requestedByUserId: 'staff-1' });
    });

    it('is exempt from the one-request-per-season limit', async () => {
      asStaff();
      mocks.queue.push([match()], [], [{ used: MAX_RESCHEDULE_REQUESTS_PER_SEASON }], [{ id: 'req-1' }], []);
      expect(await requestReschedule(params)).toEqual({ success: true });
    });

    it('still refuses a school that is not playing in the match', async () => {
      asStaff();
      mocks.queue.push([match()]);
      const result = await requestReschedule({ ...params, schoolId: 'school-z' });
      expect(result.error).toMatch(/not playing/);
      expect(mocks.inserted).toEqual([]);
    });

    it('still leaves a one-school match to the admin matches page', async () => {
      asStaff();
      mocks.queue.push([match({ awaySchoolId: 'school-a' })]);
      expect((await requestReschedule(params)).error).toMatch(/moved by staff/);
    });
  });

  it('keeps the limit for a manager', async () => {
    mocks.queue.push([match()], [], [{ used: MAX_RESCHEDULE_REQUESTS_PER_SEASON }]);
    expect((await requestReschedule(params)).error).toMatch(/already used/);
  });

  it("refuses a match outside the manager's season", async () => {
    mocks.queue.push([match({ seasonId: 'season-2' })]);
    expect((await requestReschedule(params)).error).toMatch(/not in your season/);
  });

  it('refuses a school that is not playing in the match', async () => {
    mocks.queue.push([match()]);
    const result = await requestReschedule({ ...params, schoolId: 'school-z' });
    expect(result.error).toMatch(/not playing/);
    expect(mocks.inserted).toEqual([]);
  });

  it('hides an unexpected failure behind a generic message', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.queue.push(new Error('relation "match_reschedule_requests" does not exist'));
    const result = await requestReschedule(params);
    expect(result).toEqual({ success: false, error: 'Something went wrong. Please try again.' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
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

  it('enforces two proposed times, all at 7:00 PM ET, and no duplicates', async () => {
    mocks.queue.push([match()]);
    expect((await requestReschedule({ ...params, proposedTimes: [PROPOSALS[0]] })).error).toMatch(/at least 2/);
    mocks.queue.push([match()]);
    const notSevenPm = await requestReschedule({
      ...params,
      proposedTimes: ['2026-11-12T19:00', '2026-11-13T18:30'],
    });
    expect(notSevenPm.error).toMatch(/7:00 PM ET/);
    mocks.queue.push([match()]);
    const duplicate = await requestReschedule({
      ...params,
      proposedTimes: ['2026-11-12T19:00', '2026-11-12T19:00'],
    });
    expect(duplicate.error).toMatch(/one hour apart/);
    expect(mocks.inserted).toEqual([]);
  });

  it('stores the request and its options, as on time when 72+ hours ahead', async () => {
    mocks.queue.push([match()], [], [{ used: 0 }], [{ id: 'req-1' }], []);
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
    mocks.queue.push([match({ scheduledAt: new Date(NOW.getTime() + 48 * HOUR) })], [], [{ used: 0 }], [{ id: 'req-1' }], []);
    await requestReschedule({ ...params, proposedTimes: ['2026-10-28T19:00', '2026-10-29T19:00'] });
    expect(mocks.inserted[0][0]).toMatchObject({ isLate: true });
  });

  it('refuses a second request from the school in the same season, and writes nothing', async () => {
    mocks.queue.push([match()], [], [{ used: MAX_RESCHEDULE_REQUESTS_PER_SEASON }]);
    const result = await requestReschedule(params);
    expect(result).toEqual({
      success: false,
      error: 'Your school has already used its one reschedule for this season.',
    });
    expect(mocks.inserted).toEqual([]);
  });

  it('counts the school’s own non-cancelled requests in this season, locking the school row first', async () => {
    mocks.queue.push([match()], [], [{ used: 0 }], [{ id: 'req-1' }], []);
    await requestReschedule(params);
    // Reads in order: the match, the school row lock, then the per-season count.
    const [, lockWhere, countWhere] = mocks.wheres as unknown[];
    expect(mocks.paramValues(lockWhere)).toEqual(['school-a']);
    expect(mocks.paramValues(countWhere)).toEqual(expect.arrayContaining(['school-a', 'season-1', 'cancelled']));
  });

  it('reports an already-open request instead of failing', async () => {
    mocks.queue.push([match()], [], [{ used: 0 }], Object.assign(new Error('duplicate key'), { code: '23505' }));
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
    mocks.queue.push([request({ status: 'approved' })], [match()]);
    expect((await respondToReschedule(accept)).error).toMatch(/no longer waiting/);
  });

  it('refuses to accept once the match has been moved since the request', async () => {
    mocks.queue.push([request()], [match({ scheduledAt: new Date(MATCH_AT.getTime() + HOUR) })]);
    expect((await respondToReschedule(accept)).error).toMatch(/changed since/);
    expect(mocks.updated).toEqual([]);
  });

  it('still lets the opponent decline after the match moved or started, so the request cannot get stuck', async () => {
    mocks.queue.push([request()], [match({ status: 'live' })], [{ id: 'req-1' }]);
    const result = await respondToReschedule({ requestId: 'req-1', schoolId: 'school-b', accept: false });
    expect(result).toEqual({ success: true });
    expect(mocks.updated[0]).toMatchObject({ status: 'declined_opponent' });
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

  it('moves the match to the accepted time and approves the request in one step, with no staff step', async () => {
    const chosen = option();
    mocks.queue.push([request()], [match()], [chosen], [{ id: 'm1' }], [{ id: 'req-1' }]);
    expect(await respondToReschedule(accept)).toEqual({ success: true });
    expect(mocks.updated[0]).toEqual({ scheduledAt: chosen.proposedAt });
    expect(mocks.updated[1]).toMatchObject({
      status: 'approved',
      acceptedOptionId: 'opt-1',
      opponentRespondedByUserId: 'user-1',
    });
    expect(mocks.updated.some((u) => u.status === 'pending_staff')).toBe(false);
    expect(mocks.updateTag.mock.calls.map((c) => c[0])).toEqual(['matches', 'rosters', 'teams']);
  });

  it('lets a staff admin answer as the viewed school, recording the staff user on the responder column', async () => {
    asManager({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });
    mocks.queue.push([request()], [match()], [option()], [{ id: 'm1' }], [{ id: 'req-1' }]);
    expect(await respondToReschedule(accept)).toEqual({ success: true });
    expect(mocks.updated[1]).toMatchObject({ status: 'approved', opponentRespondedByUserId: 'staff-1' });
  });

  it('still derives the side from the viewed school for staff: the requester cannot answer its own request', async () => {
    asManager({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });
    mocks.queue.push([request()], [match()]);
    const result = await respondToReschedule({ ...accept, schoolId: 'school-a' });
    expect(result.error).toMatch(/other school has to answer/);
    expect(mocks.updated).toEqual([]);
  });

  it('guards the match move on status and the original time, and the close on the awaited status', async () => {
    mocks.queue.push([request()], [match()], [option()], [{ id: 'm1' }], [{ id: 'req-1' }]);
    await respondToReschedule(accept);
    const params = (i: number) => mocks.paramValues(mocks.wheres[i]);
    // wheres: request read, match read, option read, match move, request close.
    expect(params(3)).toEqual(expect.arrayContaining(['m1', 'scheduled', MATCH_AT]));
    expect(params(4)).toEqual(expect.arrayContaining(['req-1', 'pending_opponent']));
  });

  it('loses gracefully, moving nothing, when the match changed under the accept', async () => {
    mocks.queue.push([request()], [match()], [option()], []);
    expect((await respondToReschedule(accept)).error).toMatch(/changed since/);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('loses gracefully when the request resolved in the meantime (the transaction rolls back)', async () => {
    mocks.queue.push([request()], [match()], [option()], [{ id: 'm1' }], []);
    expect((await respondToReschedule(accept)).error).toMatch(/already resolved/);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});

describe('counterReschedule', () => {
  const counter = {
    requestId: 'req-1',
    schoolId: 'school-b',
    proposedTimes: ['2026-11-14T19:00', '2026-11-15T19:00'],
  };
  const offered = [{ proposedAt: new Date('2026-11-13T00:00:00.000Z') }, { proposedAt: new Date('2026-11-14T00:00:00.000Z') }];

  it('refuses the requesting school, a request not waiting on the opponent, and a changed match', async () => {
    mocks.queue.push([request()], [match()]);
    expect((await counterReschedule({ ...counter, schoolId: 'school-a' })).error).toMatch(/other school has to answer/);
    mocks.queue.push([request({ status: 'pending_requester' })], [match()]);
    expect((await counterReschedule(counter)).error).toMatch(/no longer waiting/);
    mocks.queue.push([request()], [match({ status: 'live' })]);
    expect((await counterReschedule(counter)).error).toMatch(/changed since/);
    expect(mocks.inserted).toEqual([]);
  });

  it('lets a staff admin send a counter-offer as the viewed opponent, recording the staff user', async () => {
    asManager({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });
    mocks.queue.push([request()], [match()], offered, [{ id: 'req-1' }], []);
    expect(await counterReschedule(counter)).toEqual({ success: true });
    expect(mocks.updated[0]).toMatchObject({ status: 'pending_requester', opponentRespondedByUserId: 'staff-1' });
  });

  it('applies the same time rules as a request', async () => {
    mocks.queue.push([request()], [match()]);
    expect((await counterReschedule({ ...counter, proposedTimes: ['2026-11-14T19:00'] })).error).toMatch(/at least 2/);
    mocks.queue.push([request()], [match()]);
    const duplicate = await counterReschedule({ ...counter, proposedTimes: ['2026-11-14T19:00', '2026-11-14T19:00'] });
    expect(duplicate.error).toMatch(/one hour apart/);
    mocks.queue.push([request()], [match()]);
    const notSevenPm = await counterReschedule({ ...counter, proposedTimes: ['2026-11-14T19:00', '2026-11-15T20:00'] });
    expect(notSevenPm.error).toMatch(/7:00 PM ET/);
  });

  it('tells the opponent to accept a time the requester already offered', async () => {
    // 19:00 ET on 12 Nov is 00:00 UTC on 13 Nov, which the requester already proposed.
    mocks.queue.push([request()], [match()], offered);
    const result = await counterReschedule({ ...counter, proposedTimes: ['2026-11-12T19:00', '2026-11-15T19:00'] });
    expect(result.error).toMatch(/already proposed/);
    expect(mocks.inserted).toEqual([]);
  });

  it('hands the choice to the requester and stores the times as the opponent’s', async () => {
    mocks.queue.push([request()], [match()], offered, [{ id: 'req-1' }], []);
    expect(await counterReschedule(counter)).toEqual({ success: true });
    expect(mocks.updated[0]).toMatchObject({ status: 'pending_requester', opponentRespondedByUserId: 'user-1' });
    const [options] = mocks.inserted as Record<string, unknown>[][];
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ requestId: 'req-1', proposedBy: 'opponent' });
  });

  it('does not revive a request that was resolved in the meantime', async () => {
    mocks.queue.push([request()], [match()], offered, []);
    expect((await counterReschedule(counter)).error).toMatch(/already resolved/);
    expect(mocks.inserted).toEqual([]);
  });
});

describe('answering a counter-offer', () => {
  const answer = { requestId: 'req-1', schoolId: 'school-a', accept: true, optionId: 'opt-9' };
  const countered = () => request({ status: 'pending_requester' });
  const counterOption = (over: Record<string, unknown> = {}) => ({
    id: 'opt-9',
    requestId: 'req-1',
    proposedBy: 'opponent',
    proposedAt: new Date(NOW.getTime() + 12 * 24 * HOUR),
    ...over,
  });

  it('is the requester’s to answer, not the opponent’s', async () => {
    mocks.queue.push([countered()], [match()]);
    const result = await respondToReschedule({ ...answer, schoolId: 'school-b' });
    expect(result.error).toMatch(/school that made the request has to answer/);
    expect(mocks.updated).toEqual([]);
  });

  it('moves the match to an accepted counter-time at once and records the requester’s answer', async () => {
    const chosen = counterOption();
    mocks.queue.push([countered()], [match()], [chosen], [{ id: 'm1' }], [{ id: 'req-1' }]);
    expect(await respondToReschedule(answer)).toEqual({ success: true });
    expect(mocks.updated[0]).toEqual({ scheduledAt: chosen.proposedAt });
    expect(mocks.updated[1]).toMatchObject({
      status: 'approved',
      acceptedOptionId: 'opt-9',
      counterRespondedByUserId: 'user-1',
    });
    expect(mocks.updated[1]).not.toHaveProperty('opponentRespondedByUserId');
  });

  it('lets the requester decline, which ends the request', async () => {
    mocks.queue.push([countered()], [match()], [{ id: 'req-1' }]);
    expect(await respondToReschedule({ ...answer, accept: false })).toEqual({ success: true });
    expect(mocks.updated[0]).toMatchObject({ status: 'declined_requester' });
  });

  it('refuses a time that is not one of the opponent’s, or has passed', async () => {
    mocks.queue.push([countered()], [match()], []);
    expect((await respondToReschedule(answer)).error).toMatch(/not part of this request/);
    mocks.queue.push([countered()], [match()], [counterOption({ proposedAt: new Date(NOW.getTime() - HOUR) })]);
    expect((await respondToReschedule(answer)).error).toMatch(/already passed/);
  });

  it('refuses to accept after the match changed, but still lets the requester decline', async () => {
    mocks.queue.push([countered()], [match({ status: 'live' })]);
    expect((await respondToReschedule(answer)).error).toMatch(/changed since/);
    mocks.queue.push([countered()], [match({ status: 'live' })], [{ id: 'req-1' }]);
    expect(await respondToReschedule({ ...answer, accept: false })).toEqual({ success: true });
  });
});

describe('which side’s times a school may pick (the SQL conditions the actions filter by)', () => {
  const option = (over: Record<string, unknown> = {}) => ({
    id: 'opt-1',
    requestId: 'req-1',
    proposedAt: new Date(NOW.getTime() + 11 * 24 * HOUR),
    ...over,
  });
  const proposers = () => mocks.wheres.flatMap(mocks.paramValues).filter((v) => v === 'requester' || v === 'opponent');

  it('limits the opponent to the requester’s times', async () => {
    mocks.queue.push([request()], [match()], [option()], [{ id: 'req-1' }]);
    await respondToReschedule({ requestId: 'req-1', schoolId: 'school-b', accept: true, optionId: 'opt-1' });
    expect(proposers()).toEqual(['requester']);
  });

  it('limits the requester to the opponent’s times after a counter-offer', async () => {
    mocks.queue.push([request({ status: 'pending_requester' })], [match()], [option()], [{ id: 'req-1' }]);
    await respondToReschedule({ requestId: 'req-1', schoolId: 'school-a', accept: true, optionId: 'opt-1' });
    expect(proposers()).toEqual(['opponent']);
  });

  it('writes each answer only over the status it read', async () => {
    mocks.queue.push([request()], [match()], [{ id: 'req-1' }]);
    await respondToReschedule({ requestId: 'req-1', schoolId: 'school-b', accept: false });
    expect(mocks.wheres.flatMap(mocks.paramValues)).toContain('pending_opponent');

    mocks.wheres.length = 0;
    mocks.queue.push([request({ status: 'pending_requester' })], [match()], [{ id: 'req-1' }]);
    await respondToReschedule({ requestId: 'req-1', schoolId: 'school-a', accept: false });
    expect(mocks.wheres.flatMap(mocks.paramValues)).toContain('pending_requester');
    expect(mocks.wheres.flatMap(mocks.paramValues)).not.toContain('pending_opponent');
  });
});

describe('cancelReschedule', () => {
  const cancel = { requestId: 'req-1', schoolId: 'school-a' };

  it('cancels only over the status it read', async () => {
    mocks.queue.push([request({ status: 'pending_requester' })], [match()], [{ id: 'req-1' }]);
    await cancelReschedule({ ...cancel, schoolId: 'school-b' });
    expect(mocks.wheres.flatMap(mocks.paramValues)).toContain('pending_requester');
  });

  it('lets a staff admin cancel as the viewed requesting school', async () => {
    asManager({ context: { userId: 'staff-1', isStaffAdmin: true }, season: null });
    mocks.queue.push([request()], [match()], [{ id: 'req-1' }]);
    expect(await cancelReschedule(cancel)).toEqual({ success: true });
    mocks.queue.push([request()], [match()]);
    expect((await cancelReschedule({ ...cancel, schoolId: 'school-b' })).error).toMatch(/Only the school that made/);
  });

  it('lets either school cancel while a counter-offer is waiting', async () => {
    mocks.queue.push([request({ status: 'pending_requester' })], [match()], [{ id: 'req-1' }]);
    expect(await cancelReschedule({ ...cancel, schoolId: 'school-b' })).toEqual({ success: true });
    mocks.queue.push([request({ status: 'pending_requester' })], [match()], [{ id: 'req-1' }]);
    expect(await cancelReschedule(cancel)).toEqual({ success: true });
  });

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
    mocks.queue.push([request({ status: 'approved' })], [match()]);
    expect((await cancelReschedule(cancel)).error).toMatch(/already been agreed/);
    expect(mocks.updated).toEqual([]);
  });

  it('refuses when the opponent agreed between the read and the write', async () => {
    mocks.queue.push([request()], [match()], []);
    expect((await cancelReschedule(cancel)).error).toMatch(/already been agreed/);
  });
});
