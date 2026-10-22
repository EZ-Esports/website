/**
 * Pure helpers for the staff season filters (spec-025): the Active / Inactive /
 * All tabs on League Setup, the League Setup -> Matches deep link, and the
 * URL-param validation behind Matches & Standings' initial game / season.
 * Free of DB and Next imports so it is unit testable and importable from both
 * server pages and client components.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeasonStatusFilter = 'active' | 'inactive' | 'all';

export const SEASON_STATUS_FILTERS: readonly SeasonStatusFilter[] = ['active', 'inactive', 'all'];

/** Anything unknown (or an array from a repeated param) falls back to Active. */
export function parseSeasonStatus(raw: string | string[] | undefined): SeasonStatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (SEASON_STATUS_FILTERS as readonly string[]).includes(value ?? '')
    ? (value as SeasonStatusFilter)
    : 'active';
}

export function filterSeasonsByStatus<T extends { isActive: boolean }>(seasons: T[], status: SeasonStatusFilter): T[] {
  if (status === 'all') return seasons;
  return seasons.filter((s) => s.isActive === (status === 'active'));
}

export function countSeasonsByStatus(seasons: { isActive: boolean }[]): Record<SeasonStatusFilter, number> {
  const active = seasons.filter((s) => s.isActive).length;
  return { active, inactive: seasons.length - active, all: seasons.length };
}

/** League Setup tab link. Active is the default, so it carries no param. */
export function leagueStatusHref(status: SeasonStatusFilter): string {
  return status === 'active' ? '/admin/league' : `/admin/league?status=${status}`;
}

/** "View matches" link on a League Setup season row. */
export function seasonMatchesHref(seasonId: string, gameSlug?: string | null): string {
  const params = new URLSearchParams({ season: seasonId });
  if (gameSlug) params.set('game', gameSlug);
  params.set(MATCHES_ORIGIN_PARAM, 'league');
  return `/admin/matches?${params.toString()}`;
}

/**
 * `from=league` marks a Matches & Standings visit that began on a League Setup
 * season row, so the page can offer a back arrow. Only known values count.
 */
export const MATCHES_ORIGIN_PARAM = 'from';

/**
 * The back arrow for Matches & Standings when it was opened from League Setup:
 * returns to the tab the season lives on (an inactive season's row is not on
 * the default Active tab). Null for a plain visit or an unknown `from`.
 */
export function matchesBackLink(
  from: string | string[] | undefined,
  season?: { isActive: boolean } | null,
): { href: string; label: string } | null {
  const value = Array.isArray(from) ? from[0] : from;
  if (value !== 'league') return null;
  return { href: leagueStatusHref(season ? seasonTab(season.isActive) : 'active'), label: 'League Setup' };
}

export interface MatchFilterGame { id: string; slug: string }
export interface MatchFilterSeason { id: string; gameId: string; isActive: boolean }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `season=all` in the URL: staff explicitly chose "All seasons" for a game, so do not default to its active one. */
export const ALL_SEASONS_PARAM = 'all';

/**
 * Resolve Matches & Standings' initial game and season from the URL. Unknown
 * slugs and ids are ignored (never an error). A season alone selects its game;
 * if a season and a game conflict, the season wins. A game with no season
 * param defaults to that game's active season (when it has one) unless
 * `season=all`. With neither param nothing is selected. Ids come back as the
 * explorer's state uses them ('' = all).
 */
export function parseMatchFilterParams(
  params: { season?: string | string[]; game?: string | string[] },
  games: MatchFilterGame[],
  seasons: MatchFilterSeason[],
): { gameId: string; seasonId: string } {
  const slug = first(params.game)?.trim().toLowerCase();
  const rawSeason = first(params.season)?.trim();

  const game = slug ? games.find((g) => g.slug.toLowerCase() === slug) : undefined;
  const season = rawSeason && UUID_RE.test(rawSeason)
    ? seasons.find((s) => s.id.toLowerCase() === rawSeason.toLowerCase())
    : undefined;

  if (season) return { gameId: season.gameId, seasonId: season.id };
  if (game && rawSeason !== ALL_SEASONS_PARAM) {
    const current = seasons.find((s) => s.gameId === game.id && s.isActive);
    return { gameId: game.id, seasonId: current?.id ?? '' };
  }
  return { gameId: game?.id ?? '', seasonId: '' };
}

/** Query string for the explorer's current game / season selection ('' when neither). */
export function matchFilterQuery(gameSlug: string | undefined, seasonId: string): string {
  const params = new URLSearchParams();
  if (seasonId) params.set('season', seasonId);
  else if (gameSlug) params.set('season', ALL_SEASONS_PARAM);
  if (gameSlug) params.set('game', gameSlug);
  return params.toString();
}

/** Which League Setup tab (other than All) a season lives under. */
export function seasonTab(isActive: boolean): Exclude<SeasonStatusFilter, 'all'> {
  return isActive ? 'active' : 'inactive';
}

/** Whether a season is listed on the given tab ('all' lists everything). */
export function seasonMatchesTab(isActive: boolean, status: SeasonStatusFilter): boolean {
  return status === 'all' || seasonTab(isActive) === status;
}

export interface SeasonMovedHint {
  tab: Exclude<SeasonStatusFilter, 'all'>;
  text: string;
  actionLabel: string;
  href: string;
}

/**
 * After a season is created or edited, the hint to show when it no longer
 * appears on the tab staff are looking at; null when it still does.
 */
export function seasonMovedHint(isActive: boolean, current: SeasonStatusFilter): SeasonMovedHint | null {
  if (seasonMatchesTab(isActive, current)) return null;
  const tab = seasonTab(isActive);
  const name = tab === 'active' ? 'Active' : 'Inactive';
  return { tab, text: `It is now under the ${name} tab.`, actionLabel: `Show ${name}`, href: leagueStatusHref(tab) };
}

/**
 * Next game / season state when the explorer's Season select changes. Picking
 * a season selects its game (so the UI matches what a reload would show);
 * "All seasons" ('') keeps the current game.
 */
export function nextFiltersOnSeasonChange(
  seasonId: string,
  currentGameId: string,
  seasons: { id: string; gameId: string }[],
): { gameId: string; seasonId: string } {
  if (!seasonId) return { gameId: currentGameId, seasonId: '' };
  const gameId = seasons.find((s) => s.id === seasonId)?.gameId;
  return { gameId: gameId || currentGameId, seasonId };
}

/**
 * React key for the Matches explorer, derived from the server-validated
 * filters only. When a navigation changes them (sidebar link, "View matches"
 * deep link) the explorer remounts with fresh state and first page. The
 * explorer's own history.replaceState writes never re-run the server page, so
 * they cannot change this key.
 */
export function matchExplorerKey(initialGameId: string, initialSeasonId: string): string {
  return `${initialGameId || 'all'}:${initialSeasonId || 'all'}`;
}
