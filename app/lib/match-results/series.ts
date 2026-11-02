/**
 * Pure rules for turning fetched games into a best-of-3 series result: which school played which
 * side of each game, whether the participants really are the two schools, when the game was
 * played, and the series score. No I/O, so every refusal is unit-tested against fixtures.
 */
import type { NormalizedGame, TeamSide } from './types';

/** Wins that decide a best-of-3. */
export const WINS_TO_TAKE_SERIES = 2;
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

/** The Riot IDs of every enrolled player (starters and subs, coaches excluded) of each school's roster. */
export interface RosterRiotIds {
  home: ReadonlySet<string>;
  away: ReadonlySet<string>;
}

export interface GameAttribution {
  /** Which roster played Red and which played Blue. */
  rosterBySide: Record<TeamSide, RosterSlot>;
}

export type AttributionResult =
  | { ok: true; attribution: GameAttribution }
  | { ok: false; error: string };

/**
 * Decides which school played each side of one game. A side belongs to a school only when EVERY
 * player on it is on that school's roster (starters and subs alike: a roster holds up to 10 and any
 * 5 may play), and the two sides must belong to different schools. Sides may swap between games.
 * Anyone on a side who is not on that school's roster rejects the game, naming the Riot IDs.
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
    const players = game.players.filter((p) => p.side === side);
    if (players.length === 0) {
      return { ok: false, error: `The ${side} team has no players, so it cannot be placed.` };
    }
    const entries = players.map((p) => ({
      id: `${p.name}#${p.tag}`,
      home: rosters.home.has(riotIdKey(p.name, p.tag)),
      away: rosters.away.has(riotIdKey(p.name, p.tag)),
    }));
    const allHome = entries.every((e) => e.home);
    const allAway = entries.every((e) => e.away);
    if (allHome && allAway) {
      return {
        ok: false,
        error: `Every player on the ${side} team is on both schools' rosters, so it cannot be placed. Check the Riot IDs on both rosters.`,
      };
    }
    if (allHome || allAway) {
      rosterBySide[side] = allHome ? 'home' : 'away';
      continue;
    }
    const homeCount = entries.filter((e) => e.home).length;
    const awayCount = entries.filter((e) => e.away).length;
    if (homeCount > 0 && awayCount > 0) {
      return {
        ok: false,
        error: `The ${side} team mixes players from both schools' rosters (${entries.map((e) => e.id).join(', ')}). Each team must be one school.`,
      };
    }
    const owner: RosterSlot = homeCount > 0 ? 'home' : 'away';
    const outsiders = entries.filter((e) => !e[owner]).map((e) => e.id);
    const one = outsiders.length === 1;
    return {
      ok: false,
      error: `The ${side} team has ${one ? 'a player' : 'players'} who ${one ? 'is' : 'are'} not on the roster: ${outsiders.join(', ')}.`,
    };
  }
  if (rosterBySide.Red === rosterBySide.Blue) {
    return {
      ok: false,
      error: 'Both teams in this game match the same school. It is not a game between these two schools.',
    };
  }
  return { ok: true, attribution: { rosterBySide } };
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
export function scoreSeries(
  games: readonly NormalizedGame[],
  rosters: RosterRiotIds
): SeriesOutcome {
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
    const { rosterBySide } = result.attribution;
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
