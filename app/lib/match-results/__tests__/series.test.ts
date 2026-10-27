import { describe, expect, it } from 'vitest';
import { normalizeHenrikMatch } from '../henrik-schema';
import { normalizeRiotId, riotIdKey, scoreSeries, type RosterRiotIds } from '../series';
import type { NormalizedGame } from '../types';
import { BLUE_PLAYERS, henrikPayload, playersFor, RED_PLAYERS, uuid } from './fixtures';

const keys = (names: string[], tag = 'NA1') => new Set(names.map((n) => riotIdKey(n, tag)));
// Home = the "Red" names, away = the "Blue" names.
const rosters: RosterRiotIds = { home: keys([...RED_PLAYERS, 'HomeSub']), away: keys(BLUE_PLAYERS) };

function game(n: number, opts: { homeWins: boolean; homeOnRed?: boolean; minute?: number } & Record<string, unknown>): NormalizedGame {
  const homeOnRed = opts.homeOnRed ?? true;
  const homeNames = homeOnRed ? RED_PLAYERS : RED_PLAYERS; // names stay with their roster
  const awayNames = BLUE_PLAYERS;
  const homeTeam = homeOnRed ? 'Red' : 'Blue';
  const awayTeam = homeOnRed ? 'Blue' : 'Red';
  const winner = opts.homeWins ? homeTeam : awayTeam;
  return normalizeHenrikMatch(
    henrikPayload({
      matchId: uuid(n),
      winner,
      startedAt: `2026-10-20T2${n}:00:00.000Z`,
      players: [...playersFor(homeNames, homeTeam), ...playersFor(awayNames, awayTeam)],
      ...(opts as object),
    })
  );
}

describe('scoreSeries', () => {
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

  it('follows the rosters when sides swap between games', () => {
    const out = scoreSeries([game(1, { homeWins: true, homeOnRed: false }), game(2, { homeWins: true })], rosters);
    expect(out.ok && out.series.games[0]).toMatchObject({ homeSide: 'Blue', winner: 'home' });
  });

  it('asks for the third game when two games split', () => {
    const out = scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: false })], rosters);
    expect(out).toEqual({ ok: false, errors: ['The series is 1-1 after 2 games. Add the deciding game.'] });
  });

  it('refuses a game played after the series was decided', () => {
    const out = scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: true }), game(3, { homeWins: false })], rosters);
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.errors[0]).toContain('already decided');
  });

  it('refuses a non-custom game', () => {
    const out = scoreSeries([game(1, { homeWins: true, queue: 'competitive' }), game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('Game 1: This was not a custom game');
  });

  it('refuses an incomplete or drawn game', () => {
    expect(scoreSeries([game(1, { homeWins: true, completed: false }), game(2, { homeWins: true })], rosters).ok).toBe(false);
    const draw = normalizeHenrikMatch(
      henrikPayload({ matchId: uuid(1), winner: null, redRounds: 12, blueRounds: 12 })
    );
    expect(scoreSeries([draw, game(2, { homeWins: true })], rosters).ok).toBe(false);
  });

  it('places a side from a single rostered player and reports everyone else on it', () => {
    const oneEach = normalizeHenrikMatch(
      henrikPayload({
        matchId: uuid(1),
        startedAt: '2026-10-20T20:00:00.000Z',
        players: [
          ...playersFor(['RedOne', 'Pug1', 'Pug2', 'Pug3', 'Pug4'], 'Red'),
          ...playersFor(['BlueOne', 'Pug5', 'Pug6', 'Pug7', 'Pug8'], 'Blue'),
        ],
      })
    );
    const out = scoreSeries([oneEach, game(2, { homeWins: true })], rosters);
    expect(out.ok && out.series.games[0].unrostered).toHaveLength(8);
  });

  it('refuses a game that ended by surrender or forfeit with a clear message', () => {
    const surrender = normalizeHenrikMatch(
      henrikPayload({
        matchId: uuid(1),
        winner: 'Red',
        redRounds: 4,
        blueRounds: 8,
        players: [...playersFor(RED_PLAYERS, 'Red'), ...playersFor(BLUE_PLAYERS, 'Blue')],
      })
    );
    const out = scoreSeries([surrender, game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('ended early');
  });

  it('refuses a side that splits evenly between the two rosters', () => {
    const tie = normalizeHenrikMatch(
      henrikPayload({
        matchId: uuid(1),
        players: [...playersFor(['RedOne', 'BlueOne', 'Pug1'], 'Red'), ...playersFor(['BlueTwo', 'BlueThree'], 'Blue')],
      })
    );
    const out = scoreSeries([tie, game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('cannot be placed');
  });

  it('refuses a game where a side is on neither roster', () => {
    const oneSided = normalizeHenrikMatch(
      henrikPayload({ matchId: uuid(1), players: [...playersFor(RED_PLAYERS, 'Red'), ...playersFor(['P1', 'P2', 'P3', 'P4', 'P5'], 'Blue')] })
    );
    const out = scoreSeries([oneSided, game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('No one on the Blue team');
  });

  it('refuses games whose players are not on the two rosters', () => {
    const strangers = normalizeHenrikMatch(
      henrikPayload({
        matchId: uuid(1),
        players: [...playersFor(['A1', 'A2', 'A3', 'A4', 'A5'], 'Red'), ...playersFor(BLUE_PLAYERS, 'Blue')],
      })
    );
    const out = scoreSeries([strangers, game(2, { homeWins: true })], rosters);
    expect(!out.ok && out.errors[0]).toContain('No one on the Red team');
  });

  it('refuses a game where both teams are the same roster', () => {
    const same = normalizeHenrikMatch(
      henrikPayload({
        matchId: uuid(1),
        players: [...playersFor(RED_PLAYERS, 'Red'), ...playersFor(RED_PLAYERS, 'Blue')],
      })
    );
    expect(scoreSeries([same, game(2, { homeWins: true })], rosters).ok).toBe(false);
  });

  it('tolerates one stand-in and reports them', () => {
    const standIn = normalizeHenrikMatch(
      henrikPayload({
        matchId: uuid(1),
        startedAt: '2026-10-20T20:00:00.000Z',
        players: [...playersFor([...RED_PLAYERS.slice(0, 4), 'Visitor'], 'Red'), ...playersFor(BLUE_PLAYERS, 'Blue')],
      })
    );
    const out = scoreSeries([standIn, game(2, { homeWins: true })], rosters);
    expect(out.ok && out.series.games[0].unrostered).toEqual(['Visitor#NA1']);
  });

  it('normalizes Unicode forms, spacing around # and case when matching Riot IDs', () => {
    expect(riotIdKey('Ｒed One', ' NA1')).toBe(riotIdKey('red one ', 'na1'));
    expect(normalizeRiotId('Name #  TAG')).toBe('name#tag');
  });

  it('matches Riot IDs case-insensitively', () => {
    const lower: RosterRiotIds = { home: keys(RED_PLAYERS.map((n) => n.toLowerCase())), away: keys(BLUE_PLAYERS) };
    expect(scoreSeries([game(1, { homeWins: true }), game(2, { homeWins: true })], lower).ok).toBe(true);
  });
});
