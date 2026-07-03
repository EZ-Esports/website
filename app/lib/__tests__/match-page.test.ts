import { describe, it, expect } from 'vitest';
import {
  clampPageLimit,
  normalizeSort,
  rankComputedStandings,
  pointsFromNotes,
  MAX_PAGE_SIZE,
} from '../db/match-page';

describe('clampPageLimit', () => {
  it('falls back when limit is missing or invalid', () => {
    expect(clampPageLimit(undefined, 20)).toBe(20);
    expect(clampPageLimit(NaN, 20)).toBe(20);
    expect(clampPageLimit(0, 20)).toBe(20);
  });

  it('clamps to [1, MAX_PAGE_SIZE]', () => {
    expect(clampPageLimit(-5, 20)).toBe(1);
    expect(clampPageLimit(7.9, 20)).toBe(7);
    expect(clampPageLimit(9999, 20)).toBe(MAX_PAGE_SIZE);
  });
});

describe('normalizeSort', () => {
  it('defaults everything except asc to desc', () => {
    expect(normalizeSort('asc')).toBe('asc');
    expect(normalizeSort('desc')).toBe('desc');
    expect(normalizeSort('DROP TABLE')).toBe('desc');
    expect(normalizeSort(undefined)).toBe('desc');
  });
});

describe('rankComputedStandings', () => {
  const row = (schoolName: string, wins: number | null, losses: number | null) => ({
    schoolName,
    division: 'Varsity',
    wins,
    losses,
  });

  it('ranks by wins desc, then losses asc, then name', () => {
    const ranked = rankComputedStandings([
      row('Zeta', 5, 2),
      row('Alpha', 9, 1),
      row('Beta', 5, 1),
      row('Aardvark', 5, 1),
    ]);
    expect(ranked.map((r) => [r.schoolName, r.rank])).toEqual([
      ['Alpha', 1],
      ['Aardvark', 2],
      ['Beta', 3],
      ['Zeta', 4],
    ]);
  });

  it('computes gamesPlayed and winPct, null pct when no games', () => {
    const [first, second] = rankComputedStandings([row('A', 3, 1), row('B', 0, 0)]);
    expect(first.gamesPlayed).toBe(4);
    expect(first.winPct).toBeCloseTo(0.75);
    expect(second.gamesPlayed).toBe(0);
    expect(second.winPct).toBeNull();
  });

  it('treats null wins/losses as zero', () => {
    const [only] = rankComputedStandings([row('A', null, null)]);
    expect(only.wins).toBe(0);
    expect(only.losses).toBe(0);
    expect(only.winPct).toBeNull();
  });
});

describe('pointsFromNotes', () => {
  it('extracts the points total from seeded TFT notes', () => {
    expect(pointsFromNotes('Total Points: 120.0 | Discord: player#1234')).toBe(120);
    expect(pointsFromNotes('total points: 61.5')).toBe(61.5);
  });

  it('returns null when absent or unparseable', () => {
    expect(pointsFromNotes(null)).toBeNull();
    expect(pointsFromNotes('Round Diff: +12')).toBeNull();
    expect(pointsFromNotes('Total Points: n/a')).toBeNull();
  });
});
