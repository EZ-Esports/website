/**
 * Pure rules for turning fetched games into a best-of-3 series result: which roster played which
 * side of each game, whether the participants really are the two rostered squads, and the series
 * score. No I/O, so every refusal is unit-tested against fixtures.
 */
import type { NormalizedGame, TeamSide } from './types';

/** Wins that decide a best-of-3. */
export const WINS_TO_TAKE_SERIES = 2;
/** A side is attributed to a roster only when at least this many of its players are on it. */
export const MIN_ROSTERED_PER_SIDE = 3;
/** The only queue a league match may be played in. */
export const CUSTOM_QUEUE_ID = 'custom';

export type RosterSlot = 'home' | 'away';

/** Lower-cased `name#tag`, whitespace collapsed: the key used to match a Riot account to a roster. */
export function riotIdKey(name: string, tag: string): string {
  return `${name}#${tag}`.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The Riot IDs on each side's roster (already normalized with `riotIdKey`). */
export interface RosterRiotIds {
  home: ReadonlySet<string>;
  away: ReadonlySet<string>;
}

export interface GameAttribution {
  /** Which roster played Red and which played Blue. */
  rosterBySide: Record<TeamSide, RosterSlot>;
  /** Players (`Name#Tag`) who are on neither roster: stand-ins to flag, not a reason to refuse. */
  unrostered: string[];
}

export type AttributionResult =
  | { ok: true; attribution: GameAttribution }
  | { ok: false; error: string };

/**
 * Decides which roster played each side of one game. A side belongs to a roster when at least
 * `MIN_ROSTERED_PER_SIDE` of its players are on it and it beats the other roster's count, and the
 * two sides must resolve to different rosters. Subs and one stand-in are tolerated.
 */
export function attributeGame(game: NormalizedGame, rosters: RosterRiotIds): AttributionResult {
  if (game.queueId !== CUSTOM_QUEUE_ID) {
    return { ok: false, error: 'This was not a custom game. League matches are played as custom games.' };
  }
  if (!game.isCompleted) {
    return { ok: false, error: 'This match was not completed.' };
  }
  if (!game.winningSide) {
    return { ok: false, error: 'This match has no winner (it was drawn or abandoned).' };
  }

  const rosterBySide = {} as Record<TeamSide, RosterSlot>;
  const unrostered: string[] = [];
  for (const side of ['Red', 'Blue'] as const) {
    const players = game.players.filter((p) => p.side === side);
    const keys = players.map((p) => riotIdKey(p.name, p.tag));
    const home = keys.filter((k) => rosters.home.has(k)).length;
    const away = keys.filter((k) => rosters.away.has(k)).length;
    const best = Math.max(home, away);
    if (best < MIN_ROSTERED_PER_SIDE || home === away) {
      return {
        ok: false,
        error: `The ${side} team's players do not match either roster (${best} of ${players.length} found). Check the Riot IDs on both rosters.`,
      };
    }
    rosterBySide[side] = home > away ? 'home' : 'away';
    players.forEach((p, i) => {
      if (!rosters.home.has(keys[i]) && !rosters.away.has(keys[i])) unrostered.push(`${p.name}#${p.tag}`);
    });
  }
  if (rosterBySide.Red === rosterBySide.Blue) {
    return { ok: false, error: 'Both teams in this game match the same roster. It is not a game between these two teams.' };
  }
  return { ok: true, attribution: { rosterBySide, unrostered } };
}

export interface ScoredGame {
  /** The provider match id. */
  matchId: string;
  gameNumber: number;
  startedAt: Date;
  homeSide: TeamSide;
  homeRounds: number;
  awayRounds: number;
  winner: RosterSlot;
  unrostered: string[];
}

export interface SeriesResult {
  homeWins: number;
  awayWins: number;
  winner: RosterSlot;
  games: ScoredGame[];
}

export type SeriesOutcome = { ok: true; series: SeriesResult } | { ok: false; errors: string[] };

/**
 * Validates every game and computes the series. Games are ordered by their start time, not by the
 * order they were pasted. A best-of-3 needs a side to reach two wins, with no game played after
 * it was decided; a 1-1 split after two games asks for the third.
 */
export function scoreSeries(games: readonly NormalizedGame[], rosters: RosterRiotIds): SeriesOutcome {
  const ordered = [...games].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.matchId.localeCompare(b.matchId)
  );
  const errors: string[] = [];
  const scored: ScoredGame[] = [];

  ordered.forEach((game, index) => {
    const label = `Game ${index + 1}`;
    const result = attributeGame(game, rosters);
    if (!result.ok) {
      errors.push(`${label}: ${result.error}`);
      return;
    }
    const { rosterBySide, unrostered } = result.attribution;
    const homeSide: TeamSide = rosterBySide.Red === 'home' ? 'Red' : 'Blue';
    const homeRounds = homeSide === 'Red' ? game.redRounds : game.blueRounds;
    const awayRounds = homeSide === 'Red' ? game.blueRounds : game.redRounds;
    scored.push({
      matchId: game.matchId,
      gameNumber: index + 1,
      startedAt: game.startedAt,
      homeSide,
      homeRounds,
      awayRounds,
      winner: homeRounds > awayRounds ? 'home' : 'away',
      unrostered,
    });
  });
  if (errors.length > 0) return { ok: false, errors };

  let homeWins = 0;
  let awayWins = 0;
  for (const game of scored) {
    if (homeWins >= WINS_TO_TAKE_SERIES || awayWins >= WINS_TO_TAKE_SERIES) {
      return {
        ok: false,
        errors: [`The series was already decided before game ${game.gameNumber}. Remove the extra game.`],
      };
    }
    if (game.winner === 'home') homeWins += 1;
    else awayWins += 1;
  }
  if (homeWins < WINS_TO_TAKE_SERIES && awayWins < WINS_TO_TAKE_SERIES) {
    return {
      ok: false,
      errors: [
        scored.length >= 3
          ? 'No team won two games.'
          : `The series is ${homeWins}-${awayWins} after ${scored.length} games. Add the deciding game.`,
      ],
    };
  }
  return {
    ok: true,
    series: { homeWins, awayWins, winner: homeWins > awayWins ? 'home' : 'away', games: scored },
  };
}
