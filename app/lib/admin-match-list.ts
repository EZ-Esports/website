/**
 * Pure helpers for the staff Matches list (spec-030): day grouping in Eastern
 * time and the local effect of a saved edit. Free of DB and Next imports so the
 * logic is unit testable and importable from the client explorer.
 */
import { formatNY } from './dates';
import {
  DIVISIONS,
  canonicalDivision,
  matchInTab,
  type CanonicalDivision,
  type MatchPageItemDto,
  type MatchStatus,
  type MatchTab,
} from './db/match-page';

/**
 * Schedule form: the divisions a season's rosters actually have, as canonical
 * values (stored `A`/`B` become Varsity/JV) in display order Varsity, JV, All.
 */
export function rosterDivisionOptions(rosters: { division: string }[]): CanonicalDivision[] {
  const found = new Set(rosters.map((r) => canonicalDivision(r.division)));
  return DIVISIONS.filter((d) => found.has(d));
}

/** Rosters whose division is the chosen canonical one (any stored spelling). */
export function rostersInDivision<T extends { division: string }>(rosters: T[], division: string): T[] {
  return rosters.filter((r) => canonicalDivision(r.division) === division);
}

/** True when two stored roster divisions are the same competition division. */
export function sameRosterDivision(a: string, b: string): boolean {
  return canonicalDivision(a) === canonicalDivision(b);
}

export interface MatchDayGroup<T> {
  /** America/New_York calendar day, YYYY-MM-DD. */
  key: string;
  /** "Wednesday, October 21, 2026". */
  heading: string;
  items: T[];
}

/**
 * Group an already-ordered list under its Eastern-time calendar day. Rows stay
 * in the order given; a new group starts whenever the day changes, so the result
 * is right for both sort directions and for a list that grew by "Load more".
 * Browser-local dates are never used: 11pm ET is the same day for every viewer.
 */
export function groupMatchesByDay<T extends { scheduledAt: string }>(items: T[]): MatchDayGroup<T>[] {
  const groups: MatchDayGroup<T>[] = [];
  for (const item of items) {
    const when = new Date(item.scheduledAt);
    const key = formatNY(when, 'ymd');
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, heading: formatNY(when, 'date-long'), items: [item] });
    }
  }
  return groups;
}

/**
 * The list after a row was saved: the row takes its new status and scores, and
 * leaves the list when it no longer belongs on the open tab (a saved result
 * leaves "Needs results"). Returns the new list and whether the row left.
 */
export function applySavedMatch(
  items: MatchPageItemDto[],
  matchId: string,
  saved: { status: MatchStatus; homeScore: number | null; awayScore: number | null },
  tab: MatchTab,
  now: Date,
): { items: MatchPageItemDto[]; removed: boolean } {
  let removed = false;
  const next: MatchPageItemDto[] = [];
  for (const item of items) {
    if (item.id !== matchId) {
      next.push(item);
      continue;
    }
    const updated = { ...item, ...saved };
    if (matchInTab(updated, tab, now)) next.push(updated);
    else removed = true;
  }
  return { items: next, removed };
}

/** Parse a score input: blank is null, digits only otherwise (NaN for anything else). */
export function parseScoreInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : Number.NaN;
}

/**
 * For a day's already-ordered rows: where each division block starts and how many of its rows are
 * loaded. Empty when the day holds one division, so a single-division day gets no sub-labels.
 * A block may continue on the next page; the count is of the rows loaded so far.
 */
export function divisionBlockStarts<T extends { id: string; division: string }>(
  items: T[]
): Map<string, { division: string; count: number }> {
  const starts = new Map<string, { division: string; count: number }>();
  if (new Set(items.map((i) => i.division)).size < 2) return starts;
  let current: { division: string; count: number } | null = null;
  for (const item of items) {
    if (!current || current.division !== item.division) {
      current = { division: item.division, count: 0 };
      starts.set(item.id, current);
    }
    current.count++;
  }
  return starts;
}
