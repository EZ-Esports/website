import { describe, it, expect } from 'vitest';
import {
  clampPageLimit,
  normalizeSort,
  rankComputedStandings,
  pointsFromNotes,
  canonicalDivision,
  combinedTeamLabel,
  divisionLabel,
  isDerivedStandings,
  isReconstructed,
  seasonDivisionList,
  standingsTeamLabel,
  toHubDivision,
  COMBINED_DIVISION,
  DERIVED_STANDINGS_NOTE,
  DIVISIONS,
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

  /**
   * A combined season puts two squads of one school in one table, so
   * `schoolName` stops being a unique key and the old "then name" tie-break ran
   * out of comparisons. `Array.prototype.sort` is stable only with respect to
   * input order, and the input here is an unordered SELECT — so two identical
   * requests could hand the same two rows back in either order.
   */
  const squad = (schoolName: string, division: string, wins: number, losses: number) => ({
    schoolName,
    division,
    wins,
    losses,
  });

  it('breaks a same-school tie on the division, so two squads never collide', () => {
    const [first, second] = rankComputedStandings([
      squad('Brooklyn Technical High School', 'Varsity', 4, 5),
      squad('Brooklyn Technical High School', 'JV', 4, 5),
    ]);
    expect([first.rank, second.rank]).toEqual([1, 2]);
    // 'JV' < 'Varsity', matching the pipeline's own (-wins, losses, school,
    // division) sort, so the derived snapshot and the computed fallback order an
    // identical tie the same way.
    expect([first.division, second.division]).toEqual(['JV', 'Varsity']);
  });

  it('ranks the same tied rows identically whatever order they arrive in', () => {
    const rows = [
      squad('Brooklyn Technical High School', 'Varsity', 4, 5),
      squad('Midwood High School', 'JV', 4, 5),
      squad('Brooklyn Technical High School', 'JV', 4, 5),
      squad('Midwood High School', 'Varsity', 4, 5),
    ];
    const identity = (entries: ReturnType<typeof rankComputedStandings>) =>
      entries.map((r) => `${r.rank}:${r.schoolName}:${r.division}`);
    const forward = identity(rankComputedStandings(rows));
    const reversed = identity(rankComputedStandings([...rows].reverse()));
    expect(forward).toEqual(reversed);
    // And every rank is distinct — nothing shares a place.
    expect(new Set(forward.map((entry) => entry.split(':')[0])).size).toBe(rows.length);
  });
});

describe('combinedTeamLabel', () => {
  it('appends the squad a school entered', () => {
    expect(combinedTeamLabel('Brooklyn Technical High School', 'JV')).toBe(
      'Brooklyn Technical High School — JV'
    );
    expect(combinedTeamLabel('Midwood High School', 'Varsity')).toBe('Midwood High School — Varsity');
  });

  it('reads an admin-written A/B as the squad it means', () => {
    expect(combinedTeamLabel('Bronx Science', 'B')).toBe('Bronx Science — JV');
    expect(combinedTeamLabel('Bronx Science', 'A')).toBe('Bronx Science — Varsity');
  });

  it('leaves a per-player season alone: there is no squad to name', () => {
    // TFT, osu! and Tetris run one undivided field, so "— All" would invent a
    // distinction the season never had.
    expect(combinedTeamLabel('Stuyvesant High School', 'All')).toBe('Stuyvesant High School');
  });

  it('uses an em dash, not a hyphen', () => {
    expect(combinedTeamLabel('School', 'JV')).toContain('—');
    expect(combinedTeamLabel('School', 'JV')).not.toContain(' - ');
  });
});

describe('standingsTeamLabel', () => {
  const row = { schoolName: 'Brooklyn Technical High School', division: 'JV' };

  it('names the squad in a combined table, where it is the only thing telling two rows apart', () => {
    expect(standingsTeamLabel(row, 'combined')).toBe('Brooklyn Technical High School — JV');
  });

  /**
   * The regression that matters. In a divided season the division is the active
   * tab directly above the table, so appending it to every row repeats the
   * heading on every line — the tautology PR #46 removed from the match tiles.
   */
  it('does not relabel a divided season, on any division spelling', () => {
    for (const division of ['Varsity', 'JV', 'A', 'B', 'All', '', 'C']) {
      expect(standingsTeamLabel({ ...row, division }, 'divided')).toBe(row.schoolName);
    }
  });
});

describe('seasonDivisionList', () => {
  it('collapses a combined season to one tab', () => {
    // The rows really do carry both labels; they name the squad each school
    // entered, so a Varsity/JV switch would offer two tables that never existed.
    expect(seasonDivisionList('combined', ['Varsity', 'JV', 'A', 'B'])).toEqual([
      COMBINED_DIVISION,
    ]);
  });

  it('still offers Varsity and JV for a divided season, in display order', () => {
    expect(seasonDivisionList('divided', ['JV', 'Varsity'])).toEqual(['Varsity', 'JV']);
    expect(seasonDivisionList('divided', ['B', 'A'])).toEqual(['Varsity', 'JV']);
    expect(seasonDivisionList('divided', ['All'])).toEqual(['All']);
  });

  it('falls back to Varsity when a divided season has nothing on record', () => {
    expect(seasonDivisionList('divided', [])).toEqual(['Varsity']);
  });

  it('never returns the pseudo-division for a divided season', () => {
    // `Combined` is not a stored value and `canonicalDivision` never produces
    // it, so no amount of odd column data can smuggle it into a divided season.
    expect(seasonDivisionList('divided', [COMBINED_DIVISION, null, undefined])).not.toContain(
      COMBINED_DIVISION
    );
    expect(DIVISIONS).not.toContain(COMBINED_DIVISION);
  });
});

describe('isReconstructed / isDerivedStandings', () => {
  const derived = { notes: DERIVED_STANDINGS_NOTE };
  const official = { notes: 'Final standings, Week 12 sheet' };

  it('matches the exact marker the gold pipeline writes', () => {
    expect(DERIVED_STANDINGS_NOTE).toBe('Derived from match results');
    expect(isReconstructed(DERIVED_STANDINGS_NOTE)).toBe(true);
    expect(isReconstructed(` ${DERIVED_STANDINGS_NOTE}\n`)).toBe(true);
  });

  it('does not read an unrelated note as a reconstruction', () => {
    expect(isReconstructed(official.notes)).toBe(false);
    expect(isReconstructed('Total Points: 120.0')).toBe(false);
    expect(isReconstructed(null)).toBe(false);
    expect(isReconstructed(undefined)).toBe(false);
  });

  it('calls a table reconstructed only when every row was', () => {
    expect(isDerivedStandings([derived, derived])).toBe(true);
    // One stray note must not relabel an imported archive table.
    expect(isDerivedStandings([derived, official])).toBe(false);
    expect(isDerivedStandings([official])).toBe(false);
  });

  it('makes no claim about an empty table', () => {
    // The standings page falls back to the archive caption here, which is the
    // right answer for a table that has no rows to describe.
    expect(isDerivedStandings([])).toBe(false);
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
