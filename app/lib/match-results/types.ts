/**
 * The provider-agnostic shapes of the match-results feature. Nothing here knows about HenrikDev:
 * the adapter normalizes its payload into `NormalizedGame`, and the rest of the app (series
 * scoring, validation, storage, UI) only sees these types. Swapping in Riot's official API later
 * means writing another `MatchDataPort`, nothing else.
 */

export type TeamSide = 'Red' | 'Blue';

export interface NormalizedPlayer {
  puuid: string;
  name: string;
  tag: string;
  side: TeamSide;
  agent: string;
  /** Riot's tier name at the time of the match (for example `Diamond 2`). */
  tier: string | null;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  damageDealt: number;
  damageReceived: number;
  /**
   * Derived, not read from the API (its documented schema has no MVP field): the highest score on
   * the winning side is the match MVP and the highest score on the losing side its team MVP, as
   * tracker.gg presents them. A tie on score falls to kills; a full tie yields none.
   */
  isMatchMvp: boolean;
  isTeamMvp: boolean;
}

export interface NormalizedGame {
  /** The provider's match id (lower-case UUID). */
  matchId: string;
  mapId: string;
  mapName: string;
  startedAt: Date;
  gameLengthMs: number;
  queueId: string;
  isCompleted: boolean;
  gameVersion: string | null;
  redRounds: number;
  blueRounds: number;
  /** Null for a drawn game, which a best-of-3 cannot score. */
  winningSide: TeamSide | null;
  /**
   * The declared winner did not win more rounds: a surrender or forfeit ended the game early.
   * Such a game is refused rather than scored from a partial round count.
   */
  endedEarly: boolean;
  players: NormalizedPlayer[];
}

export type FetchFailureKind =
  | 'not_found'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_response'
  | 'misconfigured';

export interface FetchFailure {
  ok: false;
  kind: FetchFailureKind;
  /** Safe to show to a manager; never contains the key or a raw upstream body. */
  message: string;
  /** Seconds until a rate-limited call may be retried, when the provider said. */
  retryAfterSeconds?: number;
}

export type FetchResult = { ok: true; game: NormalizedGame } | FetchFailure;

/** The port: fetch one finished game by its provider match id. */
export interface MatchDataPort {
  fetchMatch(matchId: string): Promise<FetchResult>;
}
