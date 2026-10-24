/**
 * Pure shaping for a school's matches in the manager portal: which side the school is on, the
 * Upcoming/Past split, and the status label. No DB or `server-only`, so it is unit-testable and
 * importable from the client component. Outcome redaction is not done here: it must run on the
 * server before the rows are mapped (see `season-outcomes.ts`).
 */
import { matchTabOf, divisionLabel, type MatchStatus } from './db/match-page';

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
}

/**
 * A school playing itself (two squads of one school) is a legal pairing: the home side wins the
 * tie so the row still reads "vs <the school>" with a stable orientation.
 */
export function toSchoolMatchItem(row: SchoolMatchRow, schoolId: string): SchoolMatchItem {
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
  };
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
