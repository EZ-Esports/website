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
  it('are 7 players and 2 subs', () => {
    expect(MAX_ROSTER_PLAYERS).toBe(7);
    expect(MAX_ROSTER_SUBS).toBe(2);
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

  it('a joiner needs room: 6 is fine, 7 is full', () => {
    const at = (playerCount: number) => rosterCapacityError({ rosterName: 'Varsity', occupancy: { playerCount, subCount: 0 }, role: 'player', joining: true });
    expect(at(6)).toBeNull();
    expect(at(7)).toBe('Varsity is full (7 of 7 players).');
  });

  it('a sub needs a free slot: 1 other sub is fine, 2 is full', () => {
    const at = (subCount: number) => rosterCapacityError({ rosterName: 'JV', occupancy: { playerCount: 4, subCount }, role: 'sub', joining: true });
    expect(at(1)).toBeNull();
    expect(at(2)).toBe('JV already has 2 substitutes.');
  });

  it('a role edit (not joining) ignores the player-count cap but not the sub cap', () => {
    const edit = (role: string, subCount: number) =>
      rosterCapacityError({ rosterName: 'Varsity', occupancy: { playerCount: 7, subCount }, role, joining: false });
    expect(edit('player', 2)).toBeNull();
    expect(edit('sub', 1)).toBeNull();
    expect(edit('sub', 2)).toBe('Varsity already has 2 substitutes.');
  });

  it('moveBlockedReason explains a full target or a sub-full target', () => {
    expect(moveBlockedReason({ name: 'JV', playerCount: 7, subCount: 0 }, false)).toBe('JV is full (7/7)');
    expect(moveBlockedReason({ name: 'JV', playerCount: 5, subCount: 2 }, true)).toBe('JV has 2 subs');
    expect(moveBlockedReason({ name: 'JV', playerCount: 5, subCount: 2 }, false)).toBeNull();
    expect(moveBlockedReason({ name: 'JV', playerCount: 6, subCount: 0 }, true)).toBeNull();
  });

  it('moveMenuItems keeps every target visible and disables the ones that cannot take the player', () => {
    const targets = [
      { id: 'a', name: 'JV', playerCount: 7, subCount: 0 },
      { id: 'b', name: 'Academy', playerCount: 3, subCount: 2 },
      { id: 'c', name: 'Alt', playerCount: 3, subCount: 0 },
    ];
    expect(moveMenuItems(targets, false)).toEqual([
      { id: 'a', text: 'JV is full (7/7)', isDisabled: true },
      { id: 'b', text: 'Academy', isDisabled: false },
      { id: 'c', text: 'Alt', isDisabled: false },
    ]);
    expect(moveMenuItems(targets, true)[1]).toEqual({ id: 'b', text: 'Academy has 2 subs', isDisabled: true });
  });
});
