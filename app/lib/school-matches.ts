/**
 * Pure shaping for a school's matches in the manager portal: which side the school is on, the
 * Upcoming/Past split, and the status label. No DB or `server-only`, so it is unit-testable and
 * importable from the client component. Outcome redaction is not done here: it must run on the
 * server before the rows are mapped (see `season-outcomes.ts`).
 */
import { matchTabOf, divisionLabel, type MatchStatus } from './db/match-page';
import { isOpenStatus, type RescheduleRequestItem } from './reschedule-rules';

/** The raw joined row a school-matches query returns, before it is turned into a portal item. */
export interface SchoolMatchRow {
  id: string;
  seasonId: string;
  seasonName: string;
  gameId: string;
  gameName: string;
  gameSlug: string;
  scheduledAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  division: string;
  homeSchoolId: string;
  homeSchoolName: string;
  awaySchoolId: string;
  awaySchoolName: string;
}

/** One match from the point of view of the school whose portal is open. Serializable. */
export interface SchoolMatchItem {
  id: string;
  gameId: string;
  gameName: string;
  /** Results can be fetched from the game's own data only for some games (see `canSubmitGameResult`). */
  gameSlug: string;
  seasonName: string;
  /** Display label (`Junior Varsity`, not `JV`). */
  division: string;
  scheduledAt: string;
  status: MatchStatus;
  opponentName: string;
  isHome: boolean;
  /** Null while the season's outcomes are unpublished (or the match has no score yet). */
  ownScore: number | null;
  opponentScore: number | null;
  /** Both sides are the same school (two squads): staff move these, a manager cannot request. */
  sameSchool: boolean;
  /** The match's most recent reschedule request, open or resolved; null when it never had one. */
  reschedule: RescheduleRequestItem | null;
  /** The time an accepted reschedule moved this match from (ISO), when one ever did. */
  rescheduledFrom: string | null;
  /** The school has used its reschedule allowance for this match's season (see `MAX_RESCHEDULE_REQUESTS_PER_SEASON`). */
  rescheduleAllowanceUsed?: boolean;
  /** Games attached from the game's own data (spec-038); 0 for a manually reported match. */
  gameCount: number;
  /** Match IDs saved while the data service was busy, waiting for "Check again"; else null. */
  pendingResult: PendingResultItem | null;
}

export interface PendingResultItem {
  /** ISO time before which a retry is pointless; null when the service gave none. */
  retryAfter: string | null;
  message: string | null;
  gameCount: number;
}

export interface ResultInfo {
  gameCount: number;
  pending: PendingResultItem | null;
}

/**
 * A school playing itself (two squads of one school) is a legal pairing: the home side wins the
 * tie so the row still reads "vs <the school>" with a stable orientation.
 */
export function toSchoolMatchItem(
  row: SchoolMatchRow,
  schoolId: string,
  reschedule: RescheduleRequestItem | null = null,
  rescheduledFrom: string | null = null,
  result: ResultInfo = { gameCount: 0, pending: null }
): SchoolMatchItem {
  const isHome = row.homeSchoolId === schoolId;
  return {
    id: row.id,
    gameId: row.gameId,
    gameName: row.gameName,
    gameSlug: row.gameSlug,
    seasonName: row.seasonName,
    division: divisionLabel(row.division),
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    opponentName: isHome ? row.awaySchoolName : row.homeSchoolName,
    isHome,
    ownScore: isHome ? row.homeScore : row.awayScore,
    opponentScore: isHome ? row.awayScore : row.homeScore,
    sameSchool: row.homeSchoolId === row.awaySchoolId,
    reschedule,
    rescheduledFrom,
    rescheduleAllowanceUsed: false,
    gameCount: result.gameCount,
    pendingResult: result.pending,
  };
}

/**
 * Whether the portal offers "Request reschedule" on this match: it must still be scheduled and
 * not started, be between two different schools, have no open request, the match must not
 * already have been moved by an approved request, and the school must not have used its
 * reschedule allowance for the season. Season view-only state is the caller's to apply (it is
 * per game); the server re-checks everything regardless.
 */
export function canRequestReschedule(
  item: Pick<SchoolMatchItem, 'status' | 'scheduledAt' | 'sameSchool' | 'reschedule'> &
    Partial<Pick<SchoolMatchItem, 'rescheduleAllowanceUsed' | 'rescheduledFrom'>>,
  now: Date
): boolean {
  return (
    item.status === 'scheduled' &&
    new Date(item.scheduledAt).getTime() > now.getTime() &&
    !item.sameSchool &&
    !(item.reschedule && isOpenStatus(item.reschedule.status)) &&
    !item.rescheduledFrom &&
    !item.rescheduleAllowanceUsed
  );
}

/** Games whose results can be fetched from the game's own data. */
export const FETCHABLE_RESULT_GAME_SLUGS: readonly string[] = ['valorant'];

/**
 * Whether the portal offers "Submit result" on this match: a fetchable game and a live or
 * scheduled match with no recorded result. Season view-only state is the caller's to apply (it is
 * per game); the server re-checks everything regardless.
 */
export function canSubmitGameResult(
  item: Pick<SchoolMatchItem, 'gameSlug' | 'status' | 'ownScore' | 'gameCount'>
): boolean {
  return (
    FETCHABLE_RESULT_GAME_SLUGS.includes(item.gameSlug) &&
    (item.status === 'scheduled' || item.status === 'live') &&
    item.ownScore === null &&
    item.gameCount === 0
  );
}

/**
 * Upcoming (soonest first) is what `matchTabOf` calls `upcoming`: live, or scheduled and not yet
 * started. Everything else is Past (newest first), including an overdue scheduled match that has
 * no result yet, so it never silently disappears from both lists.
 */
export function splitSchoolMatches(
  items: readonly SchoolMatchItem[],
  now: Date
): { upcoming: SchoolMatchItem[]; past: SchoolMatchItem[] } {
  const upcoming: SchoolMatchItem[] = [];
  const past: SchoolMatchItem[] = [];
  for (const item of items) {
    (matchTabOf(item, now) === 'upcoming' ? upcoming : past).push(item);
  }
  const byTime = (a: SchoolMatchItem, b: SchoolMatchItem) =>
    a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id);
  upcoming.sort(byTime);
  past.sort((a, b) => byTime(b, a));
  return { upcoming, past };
}

/** Display order of division labels; one a future division adds sorts after these. */
const DIVISION_ORDER = ['Varsity', 'Junior Varsity', 'All'];

/** The division labels present in the list, in display order, for the portal's division filter. */
export function divisionOptions(items: readonly Pick<SchoolMatchItem, 'division'>[]): string[] {
  const rank = (d: string) => {
    const i = DIVISION_ORDER.indexOf(d);
    return i === -1 ? DIVISION_ORDER.length : i;
  };
  return [...new Set(items.map((m) => m.division))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  );
}

/** Keeps one division's matches; `null` means every division. */
export function filterByDivision<T extends Pick<SchoolMatchItem, 'division'>>(
  items: readonly T[],
  division: string | null
): T[] {
  return division === null ? [...items] : items.filter((m) => m.division === division);
}

export function schoolMatchStatusLabel(
  item: Pick<SchoolMatchItem, 'status' | 'scheduledAt'> & { rescheduledFrom?: string | null },
  now: Date
): string {
  switch (item.status) {
    case 'live':
      return 'Live';
    case 'completed':
      return 'Completed';
    case 'forfeit':
      return 'Forfeit';
    case 'cancelled':
      return 'Cancelled';
    default:
      if (matchTabOf(item, now) !== 'upcoming') return 'Awaiting result';
      // A moved match that has not been played yet reads "Rescheduled" instead of "Scheduled".
      return item.rescheduledFrom ? 'Rescheduled' : 'Scheduled';
  }
}
