import { describe, expect, it } from 'vitest';
import { missingDivisions, planSchoolRosters, rosterNamesPhrase } from '../season-schools';
import { parseRosterFilters } from '../school-roster-view';

describe('rosterNamesPhrase', () => {
  it('uses singular for one roster and plural for several', () => {
    expect(rosterNamesPhrase(['Varsity'])).toBe('Varsity roster');
    expect(rosterNamesPhrase(['Varsity', 'JV'])).toBe('Varsity and JV rosters');
  });
});

describe('Edit rosters link (?game=)', () => {
  it('is honored by the roster editor when the school has a team in that game, and ignored otherwise', () => {
    expect(parseRosterFilters({ game: 'valorant' }, ['valorant', 'osu']).game).toBe('valorant');
    expect(parseRosterFilters({ game: 'valorant' }, ['osu']).game).toBe('');
  });
});

describe('planSchoolRosters', () => {
  it('creates Varsity (A) and JV (B) for a game with a JV split', () => {
    expect(planSchoolRosters('valorant', [])).toEqual([
      { name: 'Varsity', division: 'A', canonical: 'Varsity' },
      { name: 'JV', division: 'B', canonical: 'JV' },
    ]);
  });

  it('creates only Varsity for a team game without a JV split', () => {
    expect(planSchoolRosters('minecraft', []).map((r) => r.name)).toEqual(['Varsity']);
  });

  it('creates a single undivided roster for a tournament game', () => {
    expect(planSchoolRosters('osu', [])).toEqual([{ name: 'All', division: 'All', canonical: 'All' }]);
  });

  it('is idempotent: nothing is created once every division has a roster', () => {
    const existing = [
      { name: 'Varsity', division: 'A' },
      { name: 'JV', division: 'B' },
    ];
    expect(planSchoolRosters('valorant', existing)).toEqual([]);
    expect(missingDivisions('valorant', existing)).toEqual([]);
  });

  it('only fills the missing division and counts any stored spelling or name as present', () => {
    const existing = [{ name: 'Blue Squad', division: 'Varsity' }];
    expect(planSchoolRosters('valorant', existing).map((r) => r.name)).toEqual(['JV']);
    expect(missingDivisions('valorant', existing)).toEqual(['JV']);
  });

  it('avoids the (team, name) unique index when the name is taken by another division', () => {
    const existing = [{ name: 'Varsity', division: 'B' }];
    expect(planSchoolRosters('valorant', existing)).toEqual([
      { name: 'Varsity 2', division: 'A', canonical: 'Varsity' },
    ]);
  });
});
