/**
 * The league's rescheduling rules (rules page 4.3) as pure functions: no DB, no `server-only`,
 * so the server actions and the portal UI share one answer and the rules are unit-testable.
 *
 * Not modelled here on purpose: forfeits (staff record them), the end-of-regular-season
 * deadline (a season has no end date to check against) and "both teams already agreed to the
 * original date" (nothing records that). Staff cover those when they review a request.
 */

/** A request made with less notice than this is "late": the opposing team may decline at will. */
export const LATE_REQUEST_WINDOW_MS = 72 * 60 * 60 * 1000;

/** Proposed times must be at least this far apart so they are genuinely different options. */
export const MIN_OPTION_GAP_MS = 60 * 60 * 1000;

/** Every match starts at this Eastern wall-clock time, so a reschedule only changes the day. */
export const PROPOSED_START_TIME_ET = '19:00';

export const MIN_PROPOSED_TIMES = 2;
export const MAX_PROPOSED_TIMES = 5;
export const MAX_REASON_LENGTH = 500;
export const MAX_STAFF_NOTE_LENGTH = 500;

/**
 * How many reschedule requests a school may make per season, across all of its matches. Counts
 * the school's own requests that were not cancelled (open, approved and declined ones all count);
 * the opponent's answers and staff edits do not. Enforced server-side in `requestReschedule`.
 */
export const MAX_RESCHEDULE_REQUESTS_PER_SEASON = 1;

export const RESCHEDULE_STATUSES = [
  'pending_opponent',
  // The opponent answered with times of their own; the requester now picks one or declines.
  'pending_requester',
  'pending_staff',
  'approved',
  'declined_opponent',
  'declined_requester',
  'declined_staff',
  'cancelled',
] as const;

export type RescheduleStatus = (typeof RESCHEDULE_STATUSES)[number];

/** Which school proposed a time: the one that made the request, or the opponent's counter-offer. */
export type RescheduleProposer = 'requester' | 'opponent';

/** A request that still blocks a new one for the same match. */
export const OPEN_RESCHEDULE_STATUSES: readonly RescheduleStatus[] = [
  'pending_opponent',
  'pending_requester',
  'pending_staff',
];

export function isOpenStatus(status: RescheduleStatus): boolean {
  return OPEN_RESCHEDULE_STATUSES.includes(status);
}

/** True once a school's requests this season (see `MAX_RESCHEDULE_REQUESTS_PER_SEASON`) reach the limit. */
export function hasUsedRescheduleAllowance(requestsThisSeason: number): boolean {
  return requestsThisSeason >= MAX_RESCHEDULE_REQUESTS_PER_SEASON;
}

/** The refusal shown when a school has used its allowance for the season. */
export function rescheduleAllowanceMessage(): string {
  return MAX_RESCHEDULE_REQUESTS_PER_SEASON === 1
    ? 'Your school has already used its one reschedule for this season.'
    : `Your school has already used its ${MAX_RESCHEDULE_REQUESTS_PER_SEASON} reschedules for this season.`;
}

/** True when `date` falls on PROPOSED_START_TIME_ET in America/New_York (EST or EDT). */
export function isProposedStartTime(date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  return `${hour}:${minute}` === PROPOSED_START_TIME_ET;
}

/** True when `now` is closer than 72 hours to the match's current start (equal is on time). */
export function isLateRequest(matchScheduledAt: Date, now: Date): boolean {
  return matchScheduledAt.getTime() - now.getTime() < LATE_REQUEST_WINDOW_MS;
}

/**
 * Validates the times a requester proposes. Every time must be a real, future instant that
 * differs from the match's current time, and no two may fall within an hour of each other.
 * Returns the first problem as a message, or null when the set is acceptable.
 */
export function validateProposedTimes(
  times: readonly Date[],
  now: Date,
  matchScheduledAt: Date
): string | null {
  if (times.length < MIN_PROPOSED_TIMES) {
    return `Propose at least ${MIN_PROPOSED_TIMES} different times.`;
  }
  if (times.length > MAX_PROPOSED_TIMES) {
    return `Propose no more than ${MAX_PROPOSED_TIMES} times.`;
  }
  if (times.some((t) => Number.isNaN(t.getTime()))) {
    return 'One of the proposed times is not a valid date and time.';
  }
  if (times.some((t) => !isProposedStartTime(t))) {
    return 'Every proposed match starts at 7:00 PM ET.';
  }
  if (times.some((t) => t.getTime() <= now.getTime())) {
    return 'Proposed times must be in the future.';
  }
  if (times.some((t) => t.getTime() === matchScheduledAt.getTime())) {
    return 'A proposed time cannot be the match’s current time.';
  }
  const sorted = times.map((t) => t.getTime()).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < MIN_OPTION_GAP_MS) {
      return 'Proposed times must be at least one hour apart.';
    }
  }
  return null;
}

/**
 * Either school may cancel until someone has agreed to a time. While the opponent has not
 * answered, only the requester may (`pending_opponent`); once the opponent counters, nobody has
 * agreed to anything yet, so either may walk away (`pending_requester`), which also stops a
 * counter-offer the requester ignores from blocking the match's next request. The action
 * enforces which school may cancel in which status.
 */
export function canCancelRequest(status: RescheduleStatus): boolean {
  return status === 'pending_opponent' || status === 'pending_requester';
}

/** The opponent may accept one of the requester's times, decline, or counter with times of their own. */
export function canOpponentRespond(status: RescheduleStatus): boolean {
  return status === 'pending_opponent';
}

/** After a counter-offer the requester picks one of the opponent's times or declines. */
export function canRequesterRespond(status: RescheduleStatus): boolean {
  return status === 'pending_requester';
}

export function canStaffDecide(status: RescheduleStatus): boolean {
  return status === 'pending_staff';
}

export function rescheduleStatusLabel(status: RescheduleStatus): string {
  switch (status) {
    case 'pending_opponent':
      return 'Waiting for opponent';
    case 'pending_requester':
      return 'Counter-offer sent';
    case 'pending_staff':
      return 'Waiting for staff';
    case 'approved':
      return 'Rescheduled';
    case 'declined_opponent':
    case 'declined_requester':
    case 'declined_staff':
      return 'Declined';
    case 'cancelled':
      return 'Cancelled';
  }
}

export interface RescheduleOptionItem {
  id: string;
  /** ISO instant. */
  proposedAt: string;
  proposedBy: RescheduleProposer;
}

/** A request as the manager portal shows it (serializable). */
export interface RescheduleRequestItem {
  id: string;
  matchId: string;
  status: RescheduleStatus;
  isLate: boolean;
  reason: string;
  requestedBySchoolId: string;
  requestedBySchoolName: string;
  /** ISO instant the request was made against. */
  originalScheduledAt: string;
  options: RescheduleOptionItem[];
  acceptedOptionId: string | null;
  staffNote: string | null;
  createdAt: string;
}

/** A request waiting on staff, with the match it would move (serializable). */
export interface StaffRescheduleItem {
  id: string;
  matchId: string;
  isLate: boolean;
  reason: string;
  requestedBySchoolName: string;
  homeSchoolName: string;
  awaySchoolName: string;
  gameName: string;
  seasonName: string;
  /** The match's current start (ISO). */
  currentScheduledAt: string;
  /** The time the opponent accepted (ISO). */
  newScheduledAt: string;
  createdAt: string;
}
