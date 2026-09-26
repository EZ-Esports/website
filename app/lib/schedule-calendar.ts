import type { ScheduleCalendarItem } from './db/match-page';
import { formatNY } from './dates';

/**
 * Determine initial calendar focus based on matches list.
 * Focuses the earliest upcoming or live match (ignoring completed, forfeit, and cancelled matches).
 * If all matches are completed, focuses the most recent match.
 * Defaults to current date if the list is empty.
 */
export function getInitialDate(matches: ScheduleCalendarItem[]): Date {
  const upcoming = matches.filter((m) => m.status === 'Upcoming' || m.status === 'Live');
  if (upcoming.length > 0) {
    const sorted = [...upcoming].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    return new Date(sorted[0].scheduledAt);
  }
  if (matches.length > 0) {
    const sorted = [...matches].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
    return new Date(sorted[0].scheduledAt);
  }
  return new Date();
}

/**
 * Derives the initial (year, 0-indexed month) for the calendar anchored in America/New_York.
 */
export function getInitialYearMonth(matches: ScheduleCalendarItem[]): { year: number; month: number } {
  const date = getInitialDate(matches);
  const ymd = formatNY(date, 'ymd');
  const [y, m] = ymd.split('-').map(Number);
  return { year: y, month: m - 1 };
}

/**
 * Calculates calendar grid metrics for a given year and month (0-indexed)
 * using UTC date arithmetic to avoid any client timezone shifts.
 */
export function getMonthGrid(year: number, month: number): {
  daysInMonth: number;
  firstDayOfWeek: number;
  prevMonthDays: number;
} {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { daysInMonth, firstDayOfWeek, prevMonthDays };
}
