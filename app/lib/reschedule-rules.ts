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

export const MIN_PROPOSED_TIMES = 2;
export const MAX_PROPOSED_TIMES = 5;
export const MAX_REASON_LENGTH = 500;
export const MAX_STAFF_NOTE_LENGTH = 500;

export const RESCHEDULE_STATUSES = [
  'pending_opponent',
  'pending_staff',
  'approved',
  'declined_opponent',
  'declined_staff',
  'cancelled',
] as const;

export type RescheduleStatus = (typeof RESCHEDULE_STATUSES)[number];

/** A request that still blocks a new one for the same match. */
export const OPEN_RESCHEDULE_STATUSES: readonly RescheduleStatus[] = [
  'pending_opponent',
  'pending_staff',
];

export function isOpenStatus(status: RescheduleStatus): boolean {
  return OPEN_RESCHEDULE_STATUSES.includes(status);
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

/** Only the requesting school may cancel, and only before the opponent has agreed. */
export function canCancelRequest(status: RescheduleStatus): boolean {
  return status === 'pending_opponent';
}

export function canOpponentRespond(status: RescheduleStatus): boolean {
  return status === 'pending_opponent';
}

export function canStaffDecide(status: RescheduleStatus): boolean {
  return status === 'pending_staff';
}

export function rescheduleStatusLabel(status: RescheduleStatus): string {
  switch (status) {
    case 'pending_opponent':
      return 'Waiting for opponent';
    case 'pending_staff':
      return 'Waiting for staff';
    case 'approved':
      return 'Approved';
    case 'declined_opponent':
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
