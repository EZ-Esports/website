import { describe, expect, it } from 'vitest';
import { normalizeHenrikMatch } from '../henrik-schema';
import { EARLY_START_LEEWAY_MS, normalizeRiotId, riotIdKey, scoreSeries, type RosterRiotIds } from '../series';
import type { NormalizedGame } from '../types';
import { BLUE_PLAYERS, henrikPayload, playersFor, RED_PLAYERS, uuid } from './fixtures';

const keys = (names: string[], tag = 'NA1') => new Set(names.map((n) => riotIdKey(n, tag)));
const HOME_SUBS = ['HomeSub1', 'HomeSub2'];
const AWAY_SUBS = ['AwaySub1', 'AwaySub2'];
// Home = the "Red" names + 2 subs, away = the "Blue" names + 2 subs: a roster of 7.
const rosters: RosterRiotIds = { home: keys([...RED_PLAYERS, ...HOME_SUBS]), away: keys([...BLUE_PLAYERS, ...AWAY_SUBS]) };

/** A game built from explicit home/away line-ups; `homeOnRed` picks which in-game side home played. */
function game(
  n: number,
  opts: {
    homeWins: boolean;
    homeOnRed?: boolean;
    home?: string[];
    away?: string[];
    queue?: string;
    completed?: boolean;
    startedAt?: string;
  }
): NormalizedGame {
  const homeOnRed = opts.homeOnRed ?? true;
  const homeTeam = homeOnRed ? 'Red' : 'Blue';
  const awayTeam = homeOnRed ? 'Blue' : 'Red';
  return normalizeHenrikMatch(
    henrikPayload({
      matchId: uuid(n),
      winner: opts.homeWins ? homeTeam : awayTeam,
      startedAt: opts.startedAt ?? `2026-10-20T2${n}:00:00.000Z`,
      queue: opts.queue,
      completed: opts.completed,
      players: [...playersFor(opts.home ?? RED_PLAYERS, homeTeam), ...playersFor(opts.away ?? BLUE_PLAYERS, awayTeam)],
    })
  );
}

describe('scoreSeries: series arithmetic', () => {
  it('scores a 2-0 sweep and the winner', () => {
    const out = scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: true })], rosters);
    expect(out.ok && out.series).toMatchObject({ homeWins: 2, awayWins: 0, winner: 'home' });
  });

  it('scores a 2-1 series that goes the distance, regardless of paste order', () => {
    const g1 = game(1, { homeWins: false });
    const g2 = game(2, { homeWins: true, homeOnRed: false });
    const g3 = game(3, { homeWins: true });
    const out = scoreSeries([g3, g1, g2], rosters);
    expect(out.ok && out.series.games.map((g) => g.matchId)).toEqual([uuid(1), uuid(2), uuid(3)]);
    expect(out.ok && out.series).toMatchObject({ homeWins: 2, awayWins: 1, winner: 'home' });
  });

  it('asks for the third game when two games split', () => {
    const out = scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: false })], rosters);
    expect(out).toEqual({ ok: false, errors: ['The series is 1-1 after 2 games. Add the deciding game.'] });
  });

  it('refuses a game played after the series was decided', () => {
    const out = scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: true }), game(3, { homeWins: false })], rosters);
    expect(!out.ok && out.errors[0]).toContain('already decided');
  });
});

describe('scoreSeries: per-game checks', () => {
  it('refuses a non-custom game', () => {
    const out = scoreSeries([game(1, { homeWins: true, queue: 'competitive' }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('Game 1: This was not a custom game');
  });

  it('refuses an incomplete game, a drawn game, and an early surrender', () => {
    expect(scoreSeries([game(1, { homeWins: true, completed: false }), game(2, { homeWins: true })], rosters).ok).toBe(false);
    const draw = normalizeHenrikMatch(henrikPayload({ matchId: uuid(1), winner: null, redRounds: 12, blueRounds: 12 }));
    expect(scoreSeries([draw, game(2, { homeWins: true })], rosters).ok).toBe(false);
    const surrender = normalizeHenrikMatch(
      henrikPayload({ matchId: uuid(1), winner: 'Red', redRounds: 4, blueRounds: 8, players: [...playersFor(RED_PLAYERS, 'Red'), ...playersFor(BLUE_PLAYERS, 'Blue')] })
    );
    const out = scoreSeries([surrender, game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('ended early');
  });
});

describe('scoreSeries: every player on a side must be on one school roster', () => {
  it('accepts five starters', () => {
    expect(scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: true })], rosters).ok).toBe(true);
  });

  it('accepts four starters and one sub', () => {
    const lineup = [...RED_PLAYERS.slice(0, 4), 'HomeSub1'];
    expect(scoreSeries([game(1, { homeWins: true, home: lineup }), game(2, { homeWins: true })], rosters).ok).toBe(true);
  });

  it('accepts three starters and both subs', () => {
    const lineup = [...RED_PLAYERS.slice(0, 3), ...HOME_SUBS];
    const awayLineup = [...BLUE_PLAYERS.slice(0, 3), ...AWAY_SUBS];
    expect(scoreSeries([game(1, { homeWins: true, home: lineup, away: awayLineup }), game(2, { homeWins: true })], rosters).ok).toBe(true);
  });

  it('rejects a ringer, naming the non-roster Riot ID', () => {
    const lineup = [...RED_PLAYERS.slice(0, 4), 'Ringer'];
    const out = scoreSeries([game(1, { homeWins: true, home: lineup }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toBe('Game 1: The Red team has a player who is not on the roster: Ringer#NA1.');
  });

  it('names every outsider when there are several', () => {
    const lineup = [...RED_PLAYERS.slice(0, 3), 'Pug1', 'Pug2'];
    const out = scoreSeries([game(1, { homeWins: true, home: lineup }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('Pug1#NA1, Pug2#NA1');
  });

  it('rejects a side split across both schools', () => {
    const lineup = [...RED_PLAYERS.slice(0, 3), 'AwaySub1', BLUE_PLAYERS[0]];
    const out = scoreSeries([game(1, { homeWins: true, home: lineup }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('mixes players from both schools');
  });

  it('accepts sides that swap between games', () => {
    const out = scoreSeries([game(1, { homeWins: true, homeOnRed: false }), game(2, { homeWins: true })], rosters);
    expect(out.ok && out.series.games[0]).toMatchObject({ homeSide: 'Blue', winner: 'home' });
    expect(out.ok && out.series.games[1]).toMatchObject({ homeSide: 'Red' });
  });

  it('places a side whose only shared player is on both rosters (a ghost)', () => {
    const both: RosterRiotIds = { home: keys([...RED_PLAYERS, ...HOME_SUBS, 'Ghost']), away: keys([...BLUE_PLAYERS, ...AWAY_SUBS, 'Ghost']) };
    const lineup = [...RED_PLAYERS.slice(0, 4), 'Ghost'];
    expect(scoreSeries([game(1, { homeWins: true, home: lineup }), game(2, { homeWins: true })], both).ok).toBe(true);
  });

  it('refuses a side made up entirely of players on both rosters', () => {
    const ghosts = ['G1', 'G2', 'G3', 'G4', 'G5'];
    const both: RosterRiotIds = { home: keys([...RED_PLAYERS, ...ghosts]), away: keys([...BLUE_PLAYERS, ...ghosts]) };
    const out = scoreSeries([game(1, { homeWins: true, home: ghosts }), game(2, { homeWins: true })], both);
    expect(!out.ok && out.errors[0]).toContain('on both schools');
  });

  it.each([
    ['1v1', ['RedOne'], ['BlueOne'], 'The Red team has 1 player; a league game has 5 per side.'],
    ['2v2', RED_PLAYERS.slice(0, 2), BLUE_PLAYERS.slice(0, 2), 'The Red team has 2 players; a league game has 5 per side.'],
    ['4v5', RED_PLAYERS.slice(0, 4), BLUE_PLAYERS, 'The Red team has 4 players; a league game has 5 per side.'],
    ['5v4', RED_PLAYERS, BLUE_PLAYERS.slice(0, 4), 'The Blue team has 4 players; a league game has 5 per side.'],
    ['6v5', [...RED_PLAYERS, 'HomeSub1'], BLUE_PLAYERS, 'The Red team has 6 players; a league game has 5 per side.'],
  ])('refuses a %s game even when everyone is rostered', (_label, home, away, message) => {
    const out = scoreSeries([game(1, { homeWins: true, home, away }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toBe(`Game 1: ${message}`);
  });

  it('refuses a game where both teams are the same school', () => {
    const out = scoreSeries([game(1, { homeWins: true, away: RED_PLAYERS }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('same school');
  });

  it('refuses a side that is on neither roster', () => {
    const out = scoreSeries([game(1, { homeWins: true, away: ['P1', 'P2', 'P3', 'P4', 'P5'] }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('P1#NA1, P2#NA1, P3#NA1, P4#NA1, P5#NA1');
  });

  it('normalizes Unicode forms, spacing around # and case when matching Riot IDs', () => {
    expect(riotIdKey('Ｒed One', ' NA1')).toBe(riotIdKey('red one ', 'na1'));
    expect(normalizeRiotId('Name #  TAG')).toBe('name#tag');
    const lower: RosterRiotIds = { home: keys([...RED_PLAYERS, ...HOME_SUBS].map((n) => n.toLowerCase())), away: rosters.away };
    expect(scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: true })], lower).ok).toBe(true);
  });
});

describe('scoreSeries: scheduled-start window', () => {
  const scheduled = new Date('2026-10-20T23:00:00.000Z');
  const at = (offsetMs: number) => new Date(scheduled.getTime() + offsetMs).toISOString();
  const pair = (firstStart: string) => [
    game(1, { homeWins: true, startedAt: firstStart }),
    game(2, { homeWins: true, startedAt: at(3_600_000) }),
  ];

  it('accepts a game that starts exactly one hour before the scheduled start', () => {
    expect(scoreSeries(pair(at(-EARLY_START_LEEWAY_MS)), rosters, scheduled).ok).toBe(true);
  });

  it('rejects a game one millisecond past the leeway, with both times in the message', () => {
    const out = scoreSeries(pair(at(-EARLY_START_LEEWAY_MS - 1)), rosters, scheduled);
    expect(out.ok).toBe(false);
    const message = !out.ok ? out.errors[0] : '';
    expect(message).toContain('Game 1: It started at');
    expect(message).toContain("more than 1 hour before this match's scheduled start");
    expect(message).toMatch(/7:00 PM ET/); // 23:00Z is 7:00 PM Eastern (EDT)
    expect(message).toMatch(/5:59 PM ET|6:00 PM ET/);
  });

  it('has no upper bound: a game days after the scheduled start is accepted', () => {
    const late = [
      game(1, { homeWins: true, startedAt: at(5 * 24 * 3_600_000) }),
      game(2, { homeWins: true, startedAt: at(5 * 24 * 3_600_000 + 3_600_000) }),
    ];
    expect(scoreSeries(late, rosters, scheduled).ok).toBe(true);
  });

  it('skips the check when no scheduled time is given', () => {
    expect(scoreSeries(pair('2020-01-01T00:00:00.000Z'), rosters).ok).toBe(true);
  });
});
