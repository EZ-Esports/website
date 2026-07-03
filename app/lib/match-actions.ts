'use server';

/**
 * Public, read-only server action for lazy-loading match pages from client
 * components (public schedule + admin match list). Untrusted identifiers and
 * enums are validated here since this is a network-facing entry point; sort
 * and limit clamping live in getMatchesPage itself.
 */
import { getMatchesPage } from './db/queries';
import {
  DIVISIONS,
  toMatchesPageDto,
  type MatchCursor,
  type MatchPageResponse,
  type MatchSort,
  type MatchStatus,
} from './db/match-page';
import * as schema from './db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MatchPageRequest {
  gameId?: string;
  seasonId?: string;
  division?: string;
  status?: string;
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

export async function fetchMatchesPage(request: MatchPageRequest): Promise<MatchPageResponse> {
  const cursor =
    request.cursor &&
    UUID_RE.test(request.cursor.id) &&
    !Number.isNaN(new Date(request.cursor.scheduledAt).getTime())
      ? request.cursor
      : null;

  const page = await getMatchesPage({
    gameId: uuidOrUndefined(request.gameId),
    seasonId: uuidOrUndefined(request.seasonId),
    division: (DIVISIONS as readonly string[]).includes(request.division ?? '')
      ? request.division
      : undefined,
    status: (schema.matchStatusEnum.enumValues as readonly string[]).includes(request.status ?? '')
      ? (request.status as MatchStatus)
      : undefined,
    search: request.search?.slice(0, 100) || undefined,
    from: dateOrUndefined(request.from),
    to: dateOrUndefined(request.to),
    // getMatchesPage normalizes sort and clamps limit itself
    sort: request.sort as MatchSort | undefined,
    cursor,
    limit: request.limit,
  });

  return toMatchesPageDto(page);
}
