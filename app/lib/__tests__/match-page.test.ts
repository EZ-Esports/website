import { describe, it, expect } from 'vitest';
import {
  clampPageLimit,
  normalizeSort,
  rankComputedStandings,
  pointsFromNotes,
  canonicalDivision,
  divisionLabel,
  toHubDivision,
  HUB_DIVISIONS,
  MAX_PAGE_SIZE,
  type CanonicalDivision,
  type HubDivision,
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

/**
 * The whole point of these two functions is that every producer's spelling
 * lands somewhere. The table is exhaustive over the values the database
 * actually holds — the archive importer's `Varsity`/`JV`, Admin -> Roster's
 * `A`/`B`, per-player seasons' `All` — plus the values that are not supposed
 * to exist and did the most damage when they did.
 */
const DIVISION_TABLE: {
  stored: string | null | undefined;
  canonical: CanonicalDivision;
  hub: HubDivision;
  why: string;
}[] = [
  { stored: 'Varsity', canonical: 'Varsity', hub: 'Varsity', why: 'archive importer' },
  { stored: 'JV', canonical: 'JV', hub: 'JV', why: 'archive importer' },
  { stored: 'A', canonical: 'Varsity', hub: 'Varsity', why: 'Admin -> Roster' },
  { stored: 'B', canonical: 'JV', hub: 'JV', why: 'Admin -> Roster' },
  { stored: 'All', canonical: 'All', hub: 'Varsity', why: 'per-player season (TFT/osu!/Tetris)' },
  { stored: null, canonical: 'Varsity', hub: 'Varsity', why: 'nullable view column' },
  { stored: undefined, canonical: 'Varsity', hub: 'Varsity', why: 'missing row' },
  { stored: '', canonical: 'Varsity', hub: 'Varsity', why: 'blank' },
  { stored: 'varsity', canonical: 'Varsity', hub: 'Varsity', why: 'wrong case' },
  { stored: 'jv', canonical: 'Varsity', hub: 'Varsity', why: 'wrong case, not special-cased' },
  { stored: 'C', canonical: 'Varsity', hub: 'Varsity', why: 'a division nobody fields' },
];

describe('canonicalDivision', () => {
  it.each(DIVISION_TABLE)('maps $stored -> $canonical ($why)', ({ stored, canonical }) => {
    expect(canonicalDivision(stored)).toBe(canonical);
  });

  it('is total: no input produces null, undefined or a fourth division', () => {
    // The old hub normalizer returned null here, which collapsed the division
    // list to empty and blanked every tile on the page for TFT, osu! and
    // Tetris — the games whose only division is `All`.
    for (const { stored } of DIVISION_TABLE) {
      expect(['Varsity', 'JV', 'All']).toContain(canonicalDivision(stored));
    }
  });
});

describe('toHubDivision', () => {
  it.each(DIVISION_TABLE)('maps $stored -> $hub ($why)', ({ stored, hub }) => {
    expect(toHubDivision(stored)).toBe(hub);
  });

  it('sends everything that is not JV to Varsity, so no row is unreachable', () => {
    for (const { stored } of DIVISION_TABLE) {
      expect(HUB_DIVISIONS).toContain(toHubDivision(stored));
    }
  });

  it('agrees with canonicalDivision except that All folds into Varsity', () => {
    for (const { stored } of DIVISION_TABLE) {
      const canonical = canonicalDivision(stored);
      expect(toHubDivision(stored)).toBe(canonical === 'All' ? 'Varsity' : canonical);
    }
  });

  it('is idempotent: normalizing an already-normalized value is a no-op', () => {
    for (const division of HUB_DIVISIONS) {
      expect(toHubDivision(division)).toBe(division);
      expect(canonicalDivision(division)).toBe(division);
    }
  });
});

describe('divisionLabel', () => {
  it('spells out JV and leaves the others alone', () => {
    expect(divisionLabel('JV')).toBe('Junior Varsity');
    expect(divisionLabel('Varsity')).toBe('Varsity');
    expect(divisionLabel('All')).toBe('All');
  });
});
