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
  /** Set on individual (per-player) standings such as TFT. */
  playerName: string | null;
  playerIgn: string | null;
  notes: string | null;
}

export interface SeasonStandingsResult {
  /** 'snapshot' = archived season_standings rows; 'computed' = live view. */
  source: 'snapshot' | 'computed';
  rows: StandingRow[];
}

/**
 * Turn live roster_standings view rows (wins/losses only) into the unified
 * shape: ranked by wins desc, losses asc, then name for stable display.
 */
export function rankComputedStandings(
  rows: { schoolName: string; division: string; wins: number | null; losses: number | null }[]
): StandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    const winsDiff = (b.wins ?? 0) - (a.wins ?? 0);
    if (winsDiff !== 0) return winsDiff;
    const lossDiff = (a.losses ?? 0) - (b.losses ?? 0);
    if (lossDiff !== 0) return lossDiff;
    return a.schoolName.localeCompare(b.schoolName);
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
