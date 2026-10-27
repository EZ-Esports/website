import { describe, expect, it } from 'vitest';
import { normalizeHenrikMatch } from '../henrik-schema';
import { henrikPayload, playersFor, RED_PLAYERS, BLUE_PLAYERS, uuid } from './fixtures';

describe('normalizeHenrikMatch', () => {
  it('maps metadata, rounds, winner and per-player stats and ignores unknown fields', () => {
    const game = normalizeHenrikMatch(henrikPayload({ matchId: uuid(1).toUpperCase(), winner: 'Blue' }));
    expect(game.matchId).toBe(uuid(1));
    expect(game.mapName).toBe('Ascent');
    expect(game.queueId).toBe('custom');
    expect(game.winningSide).toBe('Blue');
    expect([game.redRounds, game.blueRounds]).toEqual([9, 13]);
    expect(game.players).toHaveLength(10);
    expect(game.players[0]).toMatchObject({ name: 'RedOne', side: 'Red', kills: 20, damageDealt: 2800, tier: 'Gold 2' });
  });

  it('derives the match MVP from the winners and the team MVP from the losers', () => {
    const game = normalizeHenrikMatch(henrikPayload({ matchId: uuid(1), winner: 'Red' }));
    expect(game.players.filter((p) => p.isMatchMvp).map((p) => p.name)).toEqual(['RedOne']);
    expect(game.players.filter((p) => p.isTeamMvp).map((p) => p.name)).toEqual(['BlueOne']);
  });

  it('invents no MVP on a full tie of score and kills', () => {
    const tied = [
      ...RED_PLAYERS.map((name) => ({ name, tag: 'NA1', team: 'Red' as const, score: 3000, kills: 15 })),
      ...playersFor(BLUE_PLAYERS, 'Blue'),
    ];
    const game = normalizeHenrikMatch(henrikPayload({ matchId: uuid(1), winner: 'Red', players: tied }));
    expect(game.players.some((p) => p.side === 'Red' && p.isMatchMvp)).toBe(false);
  });

  it('reports no winner for a drawn game', () => {
    const game = normalizeHenrikMatch(henrikPayload({ matchId: uuid(1), winner: null, redRounds: 12, blueRounds: 12 }));
    expect(game.winningSide).toBeNull();
    expect(game.players.some((p) => p.isMatchMvp)).toBe(false);
  });

  it('rejects a payload missing required fields', () => {
    const body = henrikPayload({ matchId: uuid(1) }) as { data: Record<string, unknown> };
    delete body.data.players;
    expect(() => normalizeHenrikMatch(body)).toThrow();
    expect(() => normalizeHenrikMatch({})).toThrow();
  });

  it('rejects a winner that disagrees with the round counts', () => {
    expect(() =>
      normalizeHenrikMatch(henrikPayload({ matchId: uuid(1), winner: 'Red', redRounds: 5, blueRounds: 13 }))
    ).toThrow();
  });
});
