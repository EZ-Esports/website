/**
 * Regular-season schedule generation (spec-046). Pure and deterministic: no DB, no Next, no clock,
 * so the preview a staff member confirms and the commit that writes it are computed by the same
 * function from the same inputs and can be compared by fingerprint.
 *
 * The league rule is that every school plays exactly 7 matches against 7 different opponents.
 * That is a 7-regular simple graph on n schools, which exists only for even n >= 8. The schedule
 * is built from the first 7 rounds of the circle-method round robin: each round is a perfect
 * matching (every school plays exactly once), and distinct rounds never repeat a pairing, so the
 * union is 7-regular with no rematches, and the 7 rounds map directly onto 7 weeks.
 */
import { parseEastern } from './dates';
import { PROPOSED_START_TIME_ET } from './reschedule-rules';

export const REGULAR_SEASON_MATCHES = 7;
export const MIN_SCHOOLS = REGULAR_SEASON_MATCHES + 1;

export interface ScheduledPair {
  homeId: string;
  awayId: string;
}

export interface ScheduleRound {
  /** 1-based week number. */
  round: number;
  pairs: ScheduledPair[];
}

export interface ScheduledWeekDate {
  round: number;
  dateYmd: string;
  kickoff: Date;
}

export interface SkippedWeekDate {
  dateYmd: string;
  kickoff: Date;
  matchingDaysOff: string[];
}

export interface SeasonScheduleDates {
  roundDates: ScheduledWeekDate[];
  skippedWeeks: SkippedWeekDate[];
}

/** Human-readable reason the participant count cannot form the schedule, or null when it can. */
export function validateParticipantCount(n: number, matchCount: number = REGULAR_SEASON_MATCHES): string | null {
  if (matchCount < 1 || !Number.isInteger(matchCount)) {
    return 'Season length must be at least 1 match.';
  }
  const minSchools = matchCount + 1;
  if (n < minSchools) {
    return `Select at least ${minSchools} schools: each school plays ${matchCount} different opponents, and ${n} ${n === 1 ? 'school gives' : 'schools give'} too few.`;
  }
  if (n % 2 !== 0) {
    return `You selected ${n} schools. An odd number cannot all play exactly ${matchCount} matches. Add one school or remove one.`;
  }
  return null;
}

/** mulberry32: a tiny seeded PRNG so a seed always yields the same order. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the regular-season rounds for the given school ids. Ids are sorted before the seeded shuffle
 * so the result depends only on the SET of schools and the seed, never on the order they were selected in.
 * Defaults to 7 matches per school, or any configured matchCount <= n - 1.
 */
export function generateRegularSeasonRounds(
  schoolIds: string[],
  seed = '',
  matchCount: number = REGULAR_SEASON_MATCHES
): ScheduleRound[] {
  const unique = new Set(schoolIds);
  if (unique.size !== schoolIds.length) throw new Error('Each school can only be selected once.');
  const problem = validateParticipantCount(schoolIds.length, matchCount);
  if (problem) throw new Error(problem);

  const n = schoolIds.length;
  const rand = seededRandom(seed);
  const order = [...schoolIds].sort();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const fixed = order[0];
  const others = order.slice(1);
  const rounds: ScheduleRound[] = [];
  const home = new Map<string, number>();
  for (let r = 0; r < matchCount; r++) {
    // Rotate the n-1 non-fixed schools by r, then fold the line in half.
    const line = [fixed, ...others.map((_, i) => others[(i + r) % others.length])];
    const pairs: ScheduledPair[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = line[i];
      const b = line[n - 1 - i];
      // The school with fewer home games so far hosts, so home slots spread out; ties alternate.
      const diff = (home.get(a) ?? 0) - (home.get(b) ?? 0);
      const aHosts = diff === 0 ? (i + r) % 2 === 0 : diff < 0;
      const [homeId, awayId] = aHosts ? [a, b] : [b, a];
      home.set(homeId, (home.get(homeId) ?? 0) + 1);
      pairs.push({ homeId, awayId });
    }
    rounds.push({ round: r + 1, pairs });
  }
  return rounds;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isValidYmd(value: string): boolean {
  const m = YMD.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** The calendar date `weeks` weeks after `startYmd` (pure date arithmetic, no timezone involved). */
export function addWeeksYmd(startYmd: string, weeks: number): string {
  if (!isValidYmd(startYmd)) throw new Error('Enter a valid first-week date.');
  const [y, mo, d] = startYmd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + 7 * weeks)).toISOString().slice(0, 10);
}

/** Return the Monday calendar date (YYYY-MM-DD) for any given calendar date. */
export function getMondayYmd(ymd: string): string {
  if (!isValidYmd(ymd)) throw new Error('Enter a valid date.');
  const [y, mo, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const day = dt.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(y, mo - 1, d + diff)).toISOString().slice(0, 10);
}

/** Returns which of the specified daysOff fall in the same Monday-Sunday calendar week as `dateYmd`. */
export function getMatchingDaysOffForWeek(dateYmd: string, daysOff: string[]): string[] {
  const weekMonday = getMondayYmd(dateYmd);
  return daysOff.filter((d) => isValidYmd(d) && getMondayYmd(d) === weekMonday);
}

/** True when any date in `daysOff` falls in the same calendar week as `dateYmd`. */
export function isDayOffWeek(dateYmd: string, daysOff: string[]): boolean {
  return getMatchingDaysOffForWeek(dateYmd, daysOff).length > 0;
}

/** Kickoff instant for a specific calendar date at 7:00 PM Eastern. */
export function kickoffForDate(dateYmd: string): Date {
  const kickoff = parseEastern(`${dateYmd}T${PROPOSED_START_TIME_ET}`);
  if (Number.isNaN(kickoff.getTime())) throw new Error('Could not resolve that date to a kickoff time.');
  return kickoff;
}

/**
 * Kickoff instant for a 1-based week without days off: the start date plus (week - 1) weeks at 7:00 PM Eastern,
 * the same slot reschedules are limited to. The wall time is resolved by `parseEastern` per date, so a
 * schedule that crosses a daylight-saving change keeps 7:00 PM local instead of drifting an hour.
 */
export function kickoffForRound(startYmd: string, round: number): Date {
  return kickoffForDate(addWeeksYmd(startYmd, round - 1));
}

/**
 * Computes kickoff dates for all `totalRounds` rounds, skipping any calendar week that intersects
 * with `daysOff`. Each skipped calendar week pushes subsequent rounds back by 1 week, adding weeks
 * to the end while preserving the full round count.
 */
export function computeSeasonDates(
  startYmd: string,
  totalRounds: number,
  daysOff: string[] = []
): SeasonScheduleDates {
  if (!isValidYmd(startYmd)) throw new Error('Enter a valid first-week date.');
  if (totalRounds < 1) throw new Error('Season length must be at least 1 match.');

  const roundDates: ScheduledWeekDate[] = [];
  const skippedWeeks: SkippedWeekDate[] = [];
  const uniqueDaysOff = [...new Set(daysOff.filter(isValidYmd))];

  let calendarWeek = 0;
  const MAX_CALENDAR_WEEKS = 104; // 2 years max guard

  while (roundDates.length < totalRounds && calendarWeek < MAX_CALENDAR_WEEKS) {
    const dateYmd = addWeeksYmd(startYmd, calendarWeek);
    const matching = getMatchingDaysOffForWeek(dateYmd, uniqueDaysOff);
    const kickoff = kickoffForDate(dateYmd);

    if (matching.length > 0) {
      skippedWeeks.push({
        dateYmd,
        kickoff,
        matchingDaysOff: matching,
      });
    } else {
      const round = roundDates.length + 1;
      roundDates.push({
        round,
        dateYmd,
        kickoff,
      });
    }
    calendarWeek++;
  }

  if (roundDates.length < totalRounds) {
    throw new Error('Too many days off to schedule the season within 2 years.');
  }

  return { roundDates, skippedWeeks };
}

/** Stable short hash of a schedule so confirm can prove it is writing what the preview showed. */
export function scheduleFingerprint(rounds: ScheduleRound[], startYmd: string, extra: string[] = []): string {
  const text = [
    startYmd,
    ...extra,
    ...rounds.flatMap((r) => r.pairs.map((p) => `${r.round}:${p.homeId}>${p.awayId}`)),
  ].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
