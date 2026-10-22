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
 * Whether `season` is a PAST season of its game, which school managers may only view (spec-028).
 * This is the one place the definition lives; change the policy here and nowhere else.
 *
 * `gameSeasons` are all seasons of the same game (including `season`). Names are `YYYY-YY`, which
 * sort lexicographically, so "older" is a plain string comparison.
 * - An active season is never past.
 * - If the game has an active season: past = inactive AND older than the active season. An inactive
 *   season NEWER than the active one is an upcoming/prep season and stays editable (staff prepare
 *   seasons in advance).
 * - If the game has no active season: past = inactive AND some season of the game is newer by name.
 *   The newest season is the current one and is not past.
 */
export function isPastSeason(
  season: { name: string; isActive: boolean },
  gameSeasons: ReadonlyArray<{ name: string; isActive: boolean }>
): boolean {
  if (season.isActive) return false;
  const activeNames = gameSeasons.filter((s) => s.isActive).map((s) => s.name);
  if (activeNames.length > 0) {
    const newestActive = activeNames.reduce((a, b) => (b > a ? b : a));
    return season.name < newestActive;
  }
  return gameSeasons.some((s) => s.name > season.name);
}

/** Error shown when a manager tries to change data of a past (view-only) season. */
export function pastSeasonViewOnlyError(seasonName: string): string {
  return `${seasonName} is a past season and is view-only.`;
}
