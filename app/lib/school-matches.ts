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
}

/**
 * A school playing itself (two squads of one school) is a legal pairing: the home side wins the
 * tie so the row still reads "vs <the school>" with a stable orientation.
 */
export function toSchoolMatchItem(
  row: SchoolMatchRow,
  schoolId: string,
  reschedule: RescheduleRequestItem | null = null
): SchoolMatchItem {
  const isHome = row.homeSchoolId === schoolId;
  return {
    id: row.id,
    gameId: row.gameId,
    gameName: row.gameName,
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
  };
}

/**
 * Whether the portal offers "Request reschedule" on this match: it must still be scheduled and
 * not started, be between two different schools, and have no open request. Season view-only
 * state is the caller's to apply (it is per game); the server re-checks everything regardless.
 */
export function canRequestReschedule(
  item: Pick<SchoolMatchItem, 'status' | 'scheduledAt' | 'sameSchool' | 'reschedule'>,
  now: Date
): boolean {
  return (
    item.status === 'scheduled' &&
    new Date(item.scheduledAt).getTime() > now.getTime() &&
    !item.sameSchool &&
    !(item.reschedule && isOpenStatus(item.reschedule.status))
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

export function schoolMatchStatusLabel(
  item: Pick<SchoolMatchItem, 'status' | 'scheduledAt'>,
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
      return matchTabOf(item, now) === 'upcoming' ? 'Scheduled' : 'Awaiting result';
  }
}
