import { describe, it, expect } from 'vitest';
import {
  LATE_REQUEST_WINDOW_MS,
  canCancelRequest,
  canOpponentRespond,
  canRequesterRespond,
  MAX_RESCHEDULE_REQUESTS_PER_SEASON,
  canStaffDecide,
  hasUsedRescheduleAllowance,
  isLateRequest,
  rescheduleAllowanceMessage,
  isOpenStatus,
  rescheduleStatusLabel,
  validateProposedTimes,
  RESCHEDULE_STATUSES,
} from '../reschedule-rules';
import { canRequestReschedule } from '../school-matches';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR);
const MATCH_AT = at(24 * 10);

describe('isLateRequest', () => {
  it('is on time at exactly 72 hours', () => {
    expect(isLateRequest(new Date(NOW.getTime() + LATE_REQUEST_WINDOW_MS), NOW)).toBe(false);
  });

  it('is late one millisecond under 72 hours', () => {
    expect(isLateRequest(new Date(NOW.getTime() + LATE_REQUEST_WINDOW_MS - 1), NOW)).toBe(true);
  });

  it('is on time well ahead', () => {
    expect(isLateRequest(at(24 * 7), NOW)).toBe(false);
  });
});

describe('validateProposedTimes', () => {
  it('accepts two future times an hour or more apart', () => {
    expect(validateProposedTimes([at(100), at(101)], NOW, MATCH_AT)).toBeNull();
  });

  it('requires at least two times', () => {
    expect(validateProposedTimes([at(100)], NOW, MATCH_AT)).toMatch(/at least 2/);
    expect(validateProposedTimes([], NOW, MATCH_AT)).toMatch(/at least 2/);
  });

  it('allows at most five times', () => {
    const six = [100, 102, 104, 106, 108, 110].map(at);
    expect(validateProposedTimes(six, NOW, MATCH_AT)).toMatch(/no more than 5/);
    expect(validateProposedTimes(six.slice(0, 5), NOW, MATCH_AT)).toBeNull();
  });

  it('rejects two times under an hour apart, in any order', () => {
    expect(validateProposedTimes([at(100), new Date(at(100).getTime() + HOUR - 1)], NOW, MATCH_AT)).toMatch(
      /one hour apart/
    );
    expect(validateProposedTimes([at(102), at(100), at(100.5)], NOW, MATCH_AT)).toMatch(/one hour apart/);
  });

  it('treats exactly an hour apart as acceptable', () => {
    expect(validateProposedTimes([at(100), at(101)], NOW, MATCH_AT)).toBeNull();
  });

  it('rejects duplicates', () => {
    expect(validateProposedTimes([at(100), at(100)], NOW, MATCH_AT)).toMatch(/one hour apart/);
  });

  it('rejects past times and the current time', () => {
    expect(validateProposedTimes([at(-1), at(100)], NOW, MATCH_AT)).toMatch(/future/);
    expect(validateProposedTimes([NOW, at(100)], NOW, MATCH_AT)).toMatch(/future/);
    expect(validateProposedTimes([MATCH_AT, at(100)], NOW, MATCH_AT)).toMatch(/current time/);
  });

  it('rejects an unparseable time', () => {
    expect(validateProposedTimes([new Date(NaN), at(100)], NOW, MATCH_AT)).toMatch(/not a valid/);
  });
});

describe('status helpers', () => {
  it('allows cancelling only until someone has agreed to a time', () => {
    const cancellable = RESCHEDULE_STATUSES.filter(canCancelRequest);
    expect(cancellable).toEqual(['pending_opponent', 'pending_requester']);
    expect(canCancelRequest('pending_staff')).toBe(false);
    expect(canCancelRequest('approved')).toBe(false);
  });

  it('lets the opponent answer only while waiting for them, and the requester only after a counter-offer', () => {
    expect(RESCHEDULE_STATUSES.filter(canOpponentRespond)).toEqual(['pending_opponent']);
    expect(RESCHEDULE_STATUSES.filter(canRequesterRespond)).toEqual(['pending_requester']);
  });

  it('lets staff decide only after the opponent agreed', () => {
    expect(canStaffDecide('pending_staff')).toBe(true);
    expect(canStaffDecide('pending_opponent')).toBe(false);
    expect(canStaffDecide('approved')).toBe(false);
  });

  it('counts only the pending states as open', () => {
    expect(RESCHEDULE_STATUSES.filter(isOpenStatus)).toEqual([
      'pending_opponent',
      'pending_requester',
      'pending_staff',
    ]);
  });

  it('labels every status, with every decline reading the same', () => {
    for (const status of RESCHEDULE_STATUSES) {
      expect(rescheduleStatusLabel(status)).toBeTruthy();
    }
    const declined = (['declined_opponent', 'declined_requester', 'declined_staff'] as const).map(
      rescheduleStatusLabel
    );
    expect(new Set(declined)).toEqual(new Set(['Declined']));
    expect(rescheduleStatusLabel('approved')).toBe('Rescheduled');
  });
});

describe('canRequestReschedule', () => {
  const base = {
    status: 'scheduled' as const,
    scheduledAt: at(24 * 5).toISOString(),
    sameSchool: false,
    reschedule: null,
  };
  const request = (status: (typeof RESCHEDULE_STATUSES)[number]) => ({
    id: 'r1',
    matchId: 'm1',
    status,
    isLate: false,
    reason: 'x',
    requestedBySchoolId: 's1',
    requestedBySchoolName: 'S1',
    originalScheduledAt: base.scheduledAt,
    options: [],
    acceptedOptionId: null,
    staffNote: null,
    createdAt: NOW.toISOString(),
  });

  it('offers a future scheduled match with no request', () => {
    expect(canRequestReschedule(base, NOW)).toBe(true);
  });

  it('refuses a match that is not scheduled, has started, or is a school against itself', () => {
    expect(canRequestReschedule({ ...base, status: 'live' }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, status: 'cancelled' }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, scheduledAt: at(-1).toISOString() }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, sameSchool: true }, NOW)).toBe(false);
  });

  it('refuses while a request is open but allows a new one after it resolved', () => {
    expect(canRequestReschedule({ ...base, reschedule: request('pending_opponent') }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, reschedule: request('pending_requester') }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, reschedule: request('pending_staff') }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, reschedule: request('declined_staff') }, NOW)).toBe(true);
    expect(canRequestReschedule({ ...base, reschedule: request('declined_requester') }, NOW)).toBe(true);
    expect(canRequestReschedule({ ...base, reschedule: request('cancelled') }, NOW)).toBe(true);
  });

  it('refuses a match that an approved request has already moved, whichever school asked', () => {
    expect(canRequestReschedule({ ...base, reschedule: request('approved'), rescheduledFrom: at(24 * 4).toISOString() }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...base, rescheduledFrom: at(24 * 4).toISOString() }, NOW)).toBe(false);
  });
});

describe('per-season reschedule allowance', () => {
  it('allows one request per school per season', () => {
    expect(MAX_RESCHEDULE_REQUESTS_PER_SEASON).toBe(1);
    expect(hasUsedRescheduleAllowance(0)).toBe(false);
    expect(hasUsedRescheduleAllowance(MAX_RESCHEDULE_REQUESTS_PER_SEASON - 1)).toBe(false);
    expect(hasUsedRescheduleAllowance(MAX_RESCHEDULE_REQUESTS_PER_SEASON)).toBe(true);
    expect(hasUsedRescheduleAllowance(2)).toBe(true);
  });

  it('explains the limit in plain words', () => {
    expect(rescheduleAllowanceMessage()).toBe('Your school has already used its one reschedule for this season.');
  });

  it('hides the request button for a school that has used its allowance', () => {
    const scheduled = { status: 'scheduled' as const, scheduledAt: at(24 * 5).toISOString(), sameSchool: false, reschedule: null };
    expect(canRequestReschedule({ ...scheduled, rescheduleAllowanceUsed: true }, NOW)).toBe(false);
    expect(canRequestReschedule({ ...scheduled, rescheduleAllowanceUsed: false }, NOW)).toBe(true);
  });
});
