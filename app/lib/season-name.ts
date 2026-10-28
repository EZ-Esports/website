/**
 * Canonical season naming. A season is identified by its name in the form `YYYY-YY`
 * (for example `2025-26`): the starting year, a hyphen, and the last two digits of the
 * following year. The archive already uses this shape, and school manager affiliation
 * (`school_managers.academic_year`) is stored in the same shape so the portal can match a
 * manager to a season of the game with plain string equality and no conversion.
 */

const SEASON_NAME_PATTERN = /^(\d{4})-(\d{2})$/;

/** Builds the canonical name for the season that starts in `startYear`, e.g. 2025 -> "2025-26". */
export function seasonNameFromStartYear(startYear: number): string {
  const end = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${end}`;
}

/** True when `value` is `YYYY-YY` and the second part is the first year plus one (mod 100). */
export function isValidSeasonName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = SEASON_NAME_PATTERN.exec(value);
  if (!match) return false;
  return value === seasonNameFromStartYear(Number(match[1]));
}

function buildSeasonNames(firstStartYear: number, lastStartYear: number): string[] {
  const names: string[] = [];
  for (let year = firstStartYear; year <= lastStartYear; year++) {
    names.push(seasonNameFromStartYear(year));
  }
  return names;
}

/** Every season an admin can pick for a manager affiliation (Provision / Assign tabs). */
export const SEASON_NAME_OPTIONS: readonly string[] = buildSeasonNames(2021, 2035);

/** Seasons a manager can apply for in the join wizard (the current year and the three after). */
export const MANAGER_SEASON_OPTIONS = ['2026-27', '2027-28', '2028-29', '2029-30'] as const;

/** Default manager affiliation: the current season. */
export const DEFAULT_MANAGER_SEASON: string = MANAGER_SEASON_OPTIONS[0];

export const SEASON_NAME_ERROR = 'Season must be in the format YYYY-YY (for example 2026-27).';

/**
 * Error shown when a manager tries to change data of an inactive (view-only) season (spec-028).
 * The rule itself is just `season.isActive === false`: there is no name comparison, so a season
 * older OR newer than the game's active one is equally view-only for managers.
 */
export function inactiveSeasonViewOnlyError(seasonName: string): string {
  return `${seasonName} is an inactive season and is view-only.`;
}

/**
 * The calendar year a season ends in, taken from its `YYYY-YY` name (`2026-27` -> 2027). Null for a
 * name that is not canonical (League Setup lets legacy free-text names through), so callers can
 * skip any rule that needs a date instead of guessing one.
 */
export function seasonEndYear(seasonName: string): number | null {
  if (!isValidSeasonName(seasonName)) return null;
  return Number(seasonName.slice(0, 4)) + 1;
}

/**
 * Season-eligibility rule for putting a student on a roster (spec-045): a student whose class year
 * is before the year the season ends had already graduated when it began, so they cannot play in
 * it. A student with no recorded class year, or a season with a non-canonical name, is never
 * excluded: the rule only fires on data that proves ineligibility.
 */
export function isEligibleForSeason(graduationYear: number | null | undefined, seasonName: string): boolean {
  const endYear = seasonEndYear(seasonName);
  if (endYear === null || graduationYear == null) return true;
  return graduationYear >= endYear;
}

/**
 * Refusal text for a student the eligibility rule excludes. The class year is the only thing the
 * rule can act on, so the advice is to fix it if it is wrong: managers ask a league admin (they
 * cannot edit it), staff correct it themselves.
 */
export function notEligibleForSeasonError(
  playerName: string,
  graduationYear: number,
  seasonName: string,
  audience: 'manager' | 'staff' = 'manager'
): string {
  const fix =
    audience === 'staff'
      ? 'If the class year is wrong, correct it on the member first.'
      : 'If the class year is wrong, ask a league admin to correct it.';
  return `${playerName} (class of ${graduationYear}) graduated before the ${seasonName} season and cannot be added to its rosters. ${fix}`;
}
