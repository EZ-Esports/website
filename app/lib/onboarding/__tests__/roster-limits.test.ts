import { describe, expect, it } from 'vitest';
import {
  MAX_ROSTER_PLAYERS,
  MAX_ROSTER_SUBS,
  moveBlockedReason,
  moveMenuItems,
  occupancyOf,
  rosterCapacityError,
} from '../roster-limits';

describe('roster size limits', () => {
  it('are 10 players and 5 subs', () => {
    expect(MAX_ROSTER_PLAYERS).toBe(10);
    expect(MAX_ROSTER_SUBS).toBe(5);
  });

  it('occupancyOf counts players and subs, ignoring the excepted row', () => {
    const rows = [
      { id: 'a', role: 'player' },
      { id: 'b', role: 'sub' },
      { id: 'c', role: 'sub' },
    ];
    expect(occupancyOf(rows)).toEqual({ playerCount: 3, subCount: 2 });
    expect(occupancyOf(rows, 'b')).toEqual({ playerCount: 2, subCount: 1 });
  });

  it('a joiner needs room: 9 is fine, 10 is full', () => {
    const at = (playerCount: number) => rosterCapacityError({ rosterName: 'Varsity', occupancy: { playerCount, subCount: 0 }, role: 'player', joining: true });
    expect(at(9)).toBeNull();
    expect(at(10)).toBe('Varsity is full (10 of 10 players).');
  });

  it('a sub needs a free slot: 4 other subs is fine, 5 is full', () => {
    const at = (subCount: number) => rosterCapacityError({ rosterName: 'JV', occupancy: { playerCount: 4, subCount }, role: 'sub', joining: true });
    expect(at(4)).toBeNull();
    expect(at(5)).toBe('JV already has 5 substitutes.');
  });

  it('a role edit (not joining) ignores the player-count cap but not the sub cap', () => {
    const edit = (role: string, subCount: number) =>
      rosterCapacityError({ rosterName: 'Varsity', occupancy: { playerCount: 10, subCount }, role, joining: false });
    expect(edit('player', 5)).toBeNull();
    expect(edit('sub', 4)).toBeNull();
    expect(edit('sub', 5)).toBe('Varsity already has 5 substitutes.');
  });

  it('moveBlockedReason explains a full target or a sub-full target', () => {
    expect(moveBlockedReason({ name: 'JV', playerCount: 10, subCount: 0 }, false)).toBe('JV is full (10/10)');
    expect(moveBlockedReason({ name: 'JV', playerCount: 5, subCount: 5 }, true)).toBe('JV has 5 subs');
    expect(moveBlockedReason({ name: 'JV', playerCount: 5, subCount: 5 }, false)).toBeNull();
    expect(moveBlockedReason({ name: 'JV', playerCount: 6, subCount: 0 }, true)).toBeNull();
  });

  it('moveMenuItems keeps every target visible and disables the ones that cannot take the player', () => {
    const targets = [
      { id: 'a', name: 'JV', playerCount: 10, subCount: 0 },
      { id: 'b', name: 'Academy', playerCount: 3, subCount: 5 },
      { id: 'c', name: 'Alt', playerCount: 3, subCount: 0 },
    ];
    expect(moveMenuItems(targets, false)).toEqual([
      { id: 'a', text: 'JV is full (10/10)', isDisabled: true },
      { id: 'b', text: 'Academy', isDisabled: false },
      { id: 'c', text: 'Alt', isDisabled: false },
    ]);
    expect(moveMenuItems(targets, true)[1]).toEqual({ id: 'b', text: 'Academy has 5 subs', isDisabled: true });
  });
});
