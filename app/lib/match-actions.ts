'use server';

/**
 * Server actions for lazy-loading match pages from client components. Untrusted
 * identifiers and enums are validated here since these are network-facing entry
 * points; sort and limit clamping live in getMatchesPage itself.
 *
 * `fetchMatchesPage` is the public schedule's action: anyone can call it, so it
 * strips the outcome of every match in a season staff have not published
 * (the client-supplied season id is never trusted to decide that).
 * `fetchStaffMatchesPage` is the admin list's action and returns everything,
 * but only to staff allowed into Matches.
 */
import { getMatchesPage, getMatchTabCounts, getPublicMatchesPage } from './db/queries';
import { getStaffForAdminSection } from './auth';
import {
  COMBINED_DIVISION,
  DIVISIONS,
  isMatchTab,
  toMatchesPageDto,
  type MatchCursor,
  type MatchPageResponse,
  type MatchSort,
  type MatchStatus,
  type MatchTab,
  type MatchTabCounts,
} from './db/match-page';
import * as schema from './db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MatchPageRequest {
  gameId?: string;
  seasonId?: string;
  division?: string;
  status?: string;
  /** Staff tab (needs-results | upcoming | completed | all); ignored by the public action. */
  tab?: string;
  search?: string;
  from?: string;
  to?: string;
  sort?: string;
  cursor?: MatchCursor | null;
  limit?: number;
}

const uuidOrUndefined = (v: string | undefined) =>
  v && UUID_RE.test(v) ? v : undefined;

const dateOrUndefined = (v: string | undefined) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

function toParams(request: MatchPageRequest) {
  const cursor =
    request.cursor &&
    UUID_RE.test(request.cursor.id) &&
    typeof request.cursor.home === 'string' &&
    request.cursor.home.length <= 300 &&
    (DIVISIONS as readonly string[]).includes(request.cursor.division) &&
    !Number.isNaN(new Date(request.cursor.scheduledAt).getTime())
      ? request.cursor
      : null;

  const validDivision =
    request.division === COMBINED_DIVISION ||
    (request.division && ['A', 'B', ...DIVISIONS].includes(request.division))
      ? request.division
      : undefined;

  return {
    gameId: uuidOrUndefined(request.gameId),
    seasonId: uuidOrUndefined(request.seasonId),
    division: validDivision,
    status: (schema.matchStatusEnum.enumValues as readonly string[]).includes(request.status ?? '')
      ? (request.status as MatchStatus)
      : undefined,
    tab: (isMatchTab(request.tab) ? request.tab : undefined) as MatchTab | undefined,
    search: request.search?.slice(0, 100) || undefined,
    from: dateOrUndefined(request.from),
    to: dateOrUndefined(request.to),
    // getMatchesPage normalizes sort and clamps limit itself
    sort: request.sort as MatchSort | undefined,
    cursor,
    limit: request.limit,
  };
}

/**
 * Public: matches of unpublished seasons are excluded server-side (the client `seasonId` is not trusted). The status
 * filter is ignored here (the public list never sends one) because filtering a
 * hidden season by `forfeit` would reveal which matches were forfeits. The
 * staff tab filter is ignored for the same reason (Completed would do it too).
 */
export async function fetchMatchesPage(request: MatchPageRequest): Promise<MatchPageResponse> {
  return toMatchesPageDto(await getPublicMatchesPage({ ...toParams(request), status: undefined, tab: undefined }));
}

/** Staff only: unredacted, for Admin -> Matches. */
export async function fetchStaffMatchesPage(request: MatchPageRequest): Promise<MatchPageResponse> {
  if (!(await getStaffForAdminSection('/admin/matches'))) throw new Error('Forbidden');
  // `now` is the server's clock: "past" is never taken from the client.
  return toMatchesPageDto(await getMatchesPage({ ...toParams(request), now: new Date() }));
}

/**
 * Staff only: per-tab totals for the same facets as the list (game, season,
 * division, search). Tab, sort and cursor in the request are ignored; counts
 * are always over every page of each tab.
 */
export async function fetchStaffMatchTabCounts(request: MatchPageRequest): Promise<MatchTabCounts> {
  if (!(await getStaffForAdminSection('/admin/matches'))) throw new Error('Forbidden');
  const { gameId, seasonId, division, search } = toParams(request);
  return getMatchTabCounts({ gameId, seasonId, division, search, now: new Date() });
}
