/**
 * Orchestrates one submission: reuse games we already stored, fetch only the missing ones through
 * the port, and score the series. The repository is injected so the "never request a game twice",
 * duplicate-match and error-path rules are unit-tested without a database or the network.
 */
import { attributeGame, scoreSeries, type RosterRiotIds, type SeriesResult } from './series';
import type { MatchDataPort, NormalizedGame } from './types';

export interface GameRepository {
  /** Games already fetched and stored, by provider match id. */
  findStored(matchIds: string[]): Promise<Map<string, NormalizedGame>>;
  /** Persists a freshly fetched game so it is never requested again. */
  store(game: NormalizedGame): Promise<void>;
  /** For each id already attached to a league match, that league match's id. */
  findAttachments(matchIds: string[]): Promise<Map<string, string>>;
}

export type ResolveOutcome =
  | { status: 'ok'; series: SeriesResult; games: NormalizedGame[] }
  | {
      status: 'invalid';
      errors: string[];
      /**
       * True when every error is a definitive rejection that re-asking cannot change (a roster,
       * player-count, start-time, ended-early or not-custom refusal, a match that does not exist,
       * a game already counted elsewhere). False when any error could stem from our side or the
       * provider (a missing or rotated key, schema drift, a refused request), so a saved
       * submission must be kept and retried later rather than discarded.
       */
      definitive: boolean;
    }
  | { status: 'pending'; message: string; retryAfterSeconds: number | null; fetchedCount: number };

/** The last characters of an id, enough for a manager to tell their pasted entries apart. */
function shortId(id: string): string {
  return `…${id.slice(-6)}`;
}

export async function resolveSeries(params: {
  leagueMatchId: string;
  matchIds: string[];
  rosters: RosterRiotIds;
  /** The match's current scheduled start; a game that began over an hour before it is refused. */
  scheduledAt?: Date;
  port: MatchDataPort;
  repo: GameRepository;
}): Promise<ResolveOutcome> {
  const { leagueMatchId, matchIds, rosters, scheduledAt, port, repo } = params;

  const attachments = await repo.findAttachments(matchIds);
  const taken = matchIds.filter((id) => {
    const owner = attachments.get(id);
    return owner !== undefined && owner !== leagueMatchId;
  });
  if (taken.length > 0) {
    return {
      status: 'invalid',
      errors: taken.map((id) => `Game ${shortId(id)} is already counted for a different match.`),
      definitive: true,
    };
  }

  const stored = await repo.findStored(matchIds);
  const games = new Map(stored);
  const errors: string[] = [];
  let definitive = true;
  let pending: { message: string; retryAfterSeconds: number | null } | null = null;

  for (const id of matchIds) {
    if (games.has(id)) continue;
    const result = await port.fetchMatch(id);
    if (result.ok) {
      // Stored before the series is scored, so a series refused for its score (a 1-1 split) never
      // costs a second request. Only a game that is between these two schools is kept: a rejected
      // game (not custom, ended early, strangers) must not leave other people's data in the cache.
      if (attributeGame(result.game, rosters).ok) await repo.store(result.game);
      games.set(id, result.game);
      continue;
    }
    if (result.kind === 'rate_limited' || result.kind === 'unavailable') {
      pending = { message: result.message, retryAfterSeconds: result.retryAfterSeconds ?? null };
      break; // the remaining calls would be refused too
    }
    errors.push(`Game ${shortId(id)}: ${result.message}`);
    // Only a missing match is definitive; a missing/rotated key or an unusable response is not.
    if (result.kind !== 'not_found') definitive = false;
  }

  if (errors.length > 0) return { status: 'invalid', errors, definitive };
  if (pending) {
    return { status: 'pending', ...pending, fetchedCount: games.size };
  }

  const ordered = matchIds.map((id) => games.get(id)!);
  const outcome = scoreSeries(ordered, rosters, scheduledAt);
  if (!outcome.ok) return { status: 'invalid', errors: outcome.errors, definitive: true };
  return { status: 'ok', series: outcome.series, games: ordered };
}
