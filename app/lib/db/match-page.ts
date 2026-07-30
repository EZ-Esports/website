/**
 * Pure types + helpers for paginated match lists and season standings.
 * Kept free of DB/next imports so the logic is unit-testable; queries.ts
 * does the SQL and delegates the judgment calls here.
 */
import type * as schema from './schema';

export type MatchStatus = (typeof schema.matchStatusEnum.enumValues)[number];
export type MatchSort = 'asc' | 'desc';

/** Every roster division label in display order. */
export const DIVISIONS = ['Varsity', 'JV', 'All'] as const;

/** The division vocabulary the site displays, after normalization. */
export type CanonicalDivision = (typeof DIVISIONS)[number];

/**
 * `rosters.division` and `season_standings.division` hold three spellings of
 * two ideas, written by three different producers:
 *
 * - the archive importer writes `Varsity`/`JV` (`db/import-archive.ts` maps
 *   the source spreadsheets' `A` -> Varsity and `B` -> JV);
 * - Admin -> Roster writes the raw `A`/`B` its select offers;
 * - per-player games (TFT, osu!, Tetris) run one undivided field and write
 *   `All`, because there is no Varsity/JV split to record.
 *
 * Every consumer has to agree on that mapping or a season shows a division
 * switch whose tabs are all empty — which is exactly what the game hub did to
 * every admin-managed season. `canonicalDivision` is the single answer, and it
 * is total: an unrecognised value is Varsity, never a fourth division and never
 * null, so no row can fall out of every bucket and become invisible.
 */
export function canonicalDivision(value: string | null | undefined): CanonicalDivision {
  if (value === 'JV' || value === 'B') return 'JV';
  if (value === 'All') return 'All';
  return 'Varsity';
}

/** The two divisions the game hub offers. Always both, in this order. */
export const HUB_DIVISIONS = ['Varsity', 'JV'] as const;
export type HubDivision = (typeof HUB_DIVISIONS)[number];

/**
 * `canonicalDivision` collapsed onto the hub's two tabs.
 *
 * The hub always offers both, so `All` has to land on one of them: it lands on
 * Varsity, the tab a bare game URL resolves to. A per-player game therefore
 * shows its season under Varsity and leaves JV genuinely empty, which is the
 * truth about a game that never fielded a JV division — and is what the hub
 * says instead of the blank page it used to serve when `All` mapped to nothing.
 */
export function toHubDivision(value: string | null | undefined): HubDivision {
  return canonicalDivision(value) === 'JV' ? 'JV' : 'Varsity';
}

/** Display name for a division; only JV is spelled differently than stored. */
export function divisionLabel(division: string): string {
  return division === 'JV' ? 'Junior Varsity' : division;
}

/**
 * How a season's standings are grouped, from `seasons.standings_format`.
 *
 * `divided` is the normal case and the column's default: each division ran as
 * its own competition, so each is ranked and displayed on its own.
 *
 * `combined` says the season ran *one* competition that some schools entered
 * two squads into. 2023-24 League of Legends is the case that forced this
 * column: ten team-entries, three schools fielding two squads each, and a
 * complete single round-robin in which every entry played the other nine. 23 of
 * its 48 fixtures pair an A-labelled entry against a B-labelled one and 3 are a
 * school against its own other squad, so the A/B label names *which squad a
 * school entered*, not which bracket it is ranked in. Grouping that season's
 * standings by division fabricated a 7-team "Varsity" table and a 3-team "JV"
 * table in which ~80% of the games counted were against teams not in the same
 * table — Bronx Science JV was shown 1-8 with 7 of its 9 games played against
 * Varsity-labelled opponents.
 *
 * The format is *declared* by the pipeline, never inferred here from the shape
 * of the rows: "some schools appear twice" is also what a legitimately divided
 * season looks like when a school fields both a Varsity and a JV team.
 */
export type StandingsFormat = 'divided' | 'combined';

/**
 * The single pseudo-division a combined season offers.
 *
 * Deliberately *not* a member of `DIVISIONS` and never returned by
 * `canonicalDivision`: no row is stored under this name and nothing filters by
 * it. It exists so the standings page has one tab value to render and make
 * active, in place of a Varsity/JV switch whose tabs would each promise a table
 * that does not exist.
 */
export const COMBINED_DIVISION = 'Combined';

/**
 * A row's display name in a *combined* table: the school plus the squad it
 * entered, e.g. "Brooklyn Technical High School — JV".
 *
 * This exists only for combined tables, and the asymmetry is the point. In a
 * divided season the division is already the tab heading, so appending it to
 * every row repeats what the heading says once — the same tautology PR #46
 * removed from the match tiles. In a combined table it is load-bearing:
 * Brooklyn Technical, Midwood and Bronx Science each entered two squads, so
 * without the suffix each appears twice, identically, and the reader cannot
 * tell rank 2 from rank 7.
 *
 * `All` gets the bare school name: a per-player game (TFT, osu!, Tetris) runs
 * one undivided field, so there is no squad to name and "— All" would invent a
 * distinction the season never had.
 */
export function combinedTeamLabel(schoolName: string, division: string): string {
  const squad = canonicalDivision(division);
  if (squad === 'All') return schoolName;
  // The stored spelling, not `divisionLabel`: this suffix rides along inside a
  // table cell next to a school name that is already long, and "— JV" reads at
  // a glance where "— Junior Varsity" wraps the cell to two lines.
  return `${schoolName} — ${squad}`;
}

/**
 * The name to *print* for a standings row, given the season's format. The one
 * place that decision is made, so the standings page and the game hub cannot
 * disagree about which tables get the squad suffix.
 *
 * A divided season's rows come back untouched — that is the regression this
 * function exists to make testable. Relabelling them would append the tab
 * heading to every row underneath it.
 *
 * This is a *display* string and nothing else. It must never be used as a
 * lookup key: the form guide matches `schools.name` in SQL and keys its result
 * map by the same raw string, so a squad-suffixed name there matches nothing
 * and drops every chip with no error to show for it.
 */
export function standingsTeamLabel(
  row: { schoolName: string; division: string },
  format: StandingsFormat
): string {
  return format === 'combined' ? combinedTeamLabel(row.schoolName, row.division) : row.schoolName;
}

/**
 * The division tabs a season offers, from its format and the division values its
 * rows actually carry (standings snapshot rows and rosters, in any spelling).
 *
 * A combined season offers exactly one, the `Combined` pseudo-value: its rows
 * really do carry both `Varsity` and `JV`, but those name the squad each school
 * entered, so offering them as a switch would put two tabs on screen that each
 * promise a table this competition never produced.
 *
 * Otherwise the values are canonicalized and ordered by `DIVISIONS`, and a
 * season with nothing on record still offers Varsity — a page with no tabs at
 * all is not a state any caller handles.
 */
export function seasonDivisionList(
  format: StandingsFormat,
  storedDivisions: (string | null | undefined)[]
): string[] {
  if (format === 'combined') return [COMBINED_DIVISION];
  const found = new Set(storedDivisions.map(canonicalDivision));
  const ordered = DIVISIONS.filter((d) => found.has(d));
  return ordered.length > 0 ? ordered : ['Varsity'];
}

/**
 * The exact `season_standings.notes` value the gold pipeline writes on a row it
 * tallied from match results rather than read off an official sheet
 * (`DERIVED_NOTE` in `sharepoint/normalize_gold.py`).
 *
 * Exported so the standings page and the game hub read "was this table
 * official?" the same way. Each string-matching this separately is how the two
 * end up captioning the same table differently.
 */
export const DERIVED_STANDINGS_NOTE = 'Derived from match results';

/** True when this row's record was reconstructed here, not imported. */
export function isReconstructed(notes: string | null | undefined): boolean {
  return notes?.trim() === DERIVED_STANDINGS_NOTE;
}

/**
 * True when a whole table was reconstructed from match results.
 *
 * `every`, not `some`: the pipeline marks a derived group's rows all at once, so
 * a mixed table means something upstream is wrong, and in that case the safe
 * reading is the one that does not relabel an imported archive table on the
 * strength of a single stray note. An empty table makes no claim either way.
 */
export function isDerivedStandings(rows: { notes: string | null }[]): boolean {
  return rows.length > 0 && rows.every((row) => isReconstructed(row.notes));
}

/** Keyset cursor: the sort key of the last row already delivered. */
export interface MatchCursor {
  scheduledAt: string; // ISO timestamp
  id: string;
}

export interface MatchesPageParams {
  gameId?: string;
  seasonId?: string;
  division?: string;
  status?: MatchStatus;
  /** Case-insensitive substring match against either school name. */
  search?: string;
  from?: Date;
  to?: Date;
  sort?: MatchSort;
  cursor?: MatchCursor | null;
  limit?: number;
}

/** A match row joined with its division and both school names. */
export interface MatchPageItem {
  id: string;
  seasonId: string;
  scheduledAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  division: string;
  homeTeam: string;
  awayTeam: string;
}

export interface MatchesPage {
  items: MatchPageItem[];
  /** Pass back to fetch the next page; null when this is the last page. */
  nextCursor: MatchCursor | null;
}

/** MatchPageItem with the Date flattened to ISO for client components. */
export type MatchPageItemDto = Omit<MatchPageItem, 'scheduledAt'> & { scheduledAt: string };

export interface MatchPageResponse {
  items: MatchPageItemDto[];
  nextCursor: MatchCursor | null;
}

export function toMatchesPageDto(page: MatchesPage): MatchPageResponse {
  return {
    items: page.items.map((item) => ({ ...item, scheduledAt: item.scheduledAt.toISOString() })),
    nextCursor: page.nextCursor,
  };
}

/**
 * Season-picker resolution shared by the public schedule and standings pages:
 * the season named in the URL, else the active season, else the newest.
 */
export function resolveSelectedSeason<T extends { name: string; isActive: boolean }>(
  seasons: T[],
  seasonParam: string | undefined
): T | undefined {
  return (
    seasons.find((s) => s.name === seasonParam) ??
    seasons.find((s) => s.isActive) ??
    seasons[0]
  );
}

export const MAX_PAGE_SIZE = 50;

export function clampPageLimit(limit: number | undefined, fallback: number): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

export function normalizeSort(sort: unknown): MatchSort {
  return sort === 'asc' ? 'asc' : 'desc';
}

// --- Standings ---

/** Unified row served to standings UIs from either source. */
export interface StandingRow {
  schoolName: string;
  division: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  gamesPlayed: number | null;
  winPct: number | null;
  /** Season total for point-based competitions (TFT, regular-season points). */
  points: number | null;
  /** Set on individual (per-player) standings such as TFT. */
  playerName: string | null;
  playerIgn: string | null;
  notes: string | null;
}

export interface SeasonStandingsResult {
  /** 'snapshot' = archived season_standings rows; 'computed' = live view. */
  source: 'snapshot' | 'computed';
  /**
   * Whether these rows are one table or one division's table. Reported so a
   * caller that already asked for standings doesn't have to ask the season a
   * second question to know how to label them.
   */
  standingsFormat: StandingsFormat;
  rows: StandingRow[];
}

/**
 * Turn live roster_standings view rows (wins/losses only) into the unified
 * shape: ranked by wins desc, losses asc, then name for stable display.
 *
 * The same function ranks a combined season's whole field, which is why the
 * tie-break runs one step further than "then name". Two squads of one school
 * are two rows with the same `schoolName` in a combined table, and
 * `Array.prototype.sort` is only stable with respect to *input* order — which
 * for these rows is whatever order Postgres returned an unordered SELECT in.
 * Ranking on the name alone therefore let Brooklyn Technical's Varsity and JV
 * squads swap ranks between two identical requests. The division breaks that
 * tie, mirroring the pipeline's own `(-wins, losses, school, division)` sort so
 * the computed fallback and the derived snapshot order a tie the same way.
 */
export function rankComputedStandings(
  rows: { schoolName: string; division: string; wins: number | null; losses: number | null }[]
): StandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    const winsDiff = (b.wins ?? 0) - (a.wins ?? 0);
    if (winsDiff !== 0) return winsDiff;
    const lossDiff = (a.losses ?? 0) - (b.losses ?? 0);
    if (lossDiff !== 0) return lossDiff;
    const nameDiff = a.schoolName.localeCompare(b.schoolName);
    if (nameDiff !== 0) return nameDiff;
    return a.division.localeCompare(b.division);
  });
  return sorted.map((row, i) => {
    const wins = row.wins ?? 0;
    const losses = row.losses ?? 0;
    const played = wins + losses;
    return {
      schoolName: row.schoolName,
      division: row.division,
      rank: i + 1,
      wins,
      losses,
      gamesPlayed: played,
      winPct: played > 0 ? wins / played : null,
      points: null,
      playerName: null,
      playerIgn: null,
      notes: null,
    };
  });
}

 /**
  * Extract the points total from an individual-standings notes blob, e.g.
 * "Total Points: 120.0 | Discord: player#1234" -> 120.
  */
export function pointsFromNotes(notes: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/total points:\s*([\d.]+)/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}
