/**
 * Pure rules for turning fetched games into a best-of-3 series result: which school played which
 * side of each game, whether the participants really are the two schools, and the series score.
 * No I/O, so every refusal is unit-tested against fixtures.
 */
import type { NormalizedGame, TeamSide } from './types';

/** Wins that decide a best-of-3. */
export const WINS_TO_TAKE_SERIES = 2;
/**
 * A side belongs to a school when at least this many of its players are on that school's roster.
 * Rosters are locked and include subs, so one rostered player is enough to place a side; the rest
 * of the side may be anyone and is reported, not refused.
 */
export const MIN_ROSTERED_PER_SIDE = 1;
/** The only queue a league match may be played in. */
export const CUSTOM_QUEUE_ID = 'custom';

export type RosterSlot = 'home' | 'away';

/**
 * Normalizes a full `Name#Tag` for comparison: Unicode NFKC (so look-alike forms of the same
 * characters compare equal), whitespace collapsed, spaces around the `#` removed, lower-cased.
 */
export function normalizeRiotId(raw: string): string {
  const text = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const hash = text.lastIndexOf('#');
  if (hash === -1) return text.toLowerCase();
  return `${text.slice(0, hash).trim()}#${text.slice(hash + 1).trim()}`.toLowerCase();
}

/** The key used to match a Riot account to a roster. */
export function riotIdKey(name: string, tag: string): string {
  return normalizeRiotId(`${name}#${tag}`);
}

/** The Riot IDs of every enrolled player (subs included, coaches excluded) of each school's roster. */
export interface RosterRiotIds {
  home: ReadonlySet<string>;
  away: ReadonlySet<string>;
}

export interface GameAttribution {
  /** Which roster played Red and which played Blue. */
  rosterBySide: Record<TeamSide, RosterSlot>;
  /** Players (`Name#Tag`) on a side who are not on that side's school roster: warnings for staff. */
  unrostered: string[];
}

export type AttributionResult =
  | { ok: true; attribution: GameAttribution }
  | { ok: false; error: string };

/**
 * Decides which school played each side of one game. Both rosters are checked against both sides;
 * a side belongs to the school with more of its players on the roster (at least
 * `MIN_ROSTERED_PER_SIDE`; a tie is ambiguous and refused), and the two sides must belong to
 * different schools. Sides may swap between games. Players who are not on their side's roster are
 * allowed (a roster member may be a sub) but are returned for the manager and staff to see.
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
  if (game.endedEarly) {
    return {
      ok: false,
      error:
        'This game ended early (a surrender or forfeit), so it cannot be scored from its rounds. Ask EZ Esports staff to enter the result.',
    };
  }

  const rosterBySide = {} as Record<TeamSide, RosterSlot>;
  for (const side of ['Red', 'Blue'] as const) {
    const keys = game.players.filter((p) => p.side === side).map((p) => riotIdKey(p.name, p.tag));
    const home = keys.filter((k) => rosters.home.has(k)).length;
    const away = keys.filter((k) => rosters.away.has(k)).length;
    if (Math.max(home, away) < MIN_ROSTERED_PER_SIDE) {
      return {
        ok: false,
        error: `No one on the ${side} team is on either school's roster. Check the Riot IDs on both rosters.`,
      };
    }
    if (home === away) {
      return {
        ok: false,
        error: `The ${side} team has as many players from one school's roster as the other's, so it cannot be placed. Check the Riot IDs on both rosters.`,
      };
    }
    rosterBySide[side] = home > away ? 'home' : 'away';
  }
  if (rosterBySide.Red === rosterBySide.Blue) {
    return {
      ok: false,
      error: 'Both teams in this game match the same school. It is not a game between these two schools.',
    };
  }

  const unrostered: string[] = [];
  for (const side of ['Red', 'Blue'] as const) {
    const roster = rosters[rosterBySide[side]];
    for (const p of game.players) {
      if (p.side === side && !roster.has(riotIdKey(p.name, p.tag))) unrostered.push(`${p.name}#${p.tag}`);
    }
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
  /** Players not on their side's roster in this game; shown as a warning and kept for staff. */
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
