import { describe, it, expect } from 'vitest';
import {
  DESKTOP_COLUMNS,
  TABLET_COLUMNS,
  packRowFlow,
  planGameHubLayout,
  type GameHubLayoutInput,
  type GameHubTileId,
  type GameHubTileLayout,
} from '../game-hub-layout';

/**
 * Independent occupancy check: rebuild the grid from the placements and count
 * how many times each cell is covered. Deliberately does not reuse the
 * packer's own bookkeeping, so an accounting bug in `packRowFlow` cannot hide
 * behind it.
 */
function coverage(spans: { colSpan: number; rowSpan: number }[], columns: number) {
  const { placements, rows } = packRowFlow(spans, columns);
  const counts: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  let outOfBounds = 0;
  for (const p of placements) {
    if (p.column < 0 || p.column + p.colSpan > columns) outOfBounds += 1;
    for (let r = p.row; r < p.row + p.rowSpan; r += 1) {
      for (let c = p.column; c < p.column + p.colSpan; c += 1) {
        if (r < rows && c < columns) counts[r][c] += 1;
      }
    }
  }
  const flat = counts.flat();
  return {
    rows,
    outOfBounds,
    empty: flat.filter((n) => n === 0).length,
    overlapping: flat.filter((n) => n > 1).length,
  };
}

const desktopSpans = (layout: GameHubTileLayout[]) =>
  layout.map((tile) => ({ colSpan: tile.colSpan, rowSpan: tile.rowSpan }));

/** The tablet grid stacks in a single row band — the page only row-spans at `lg`. */
const tabletSpans = (layout: GameHubTileLayout[]) =>
  layout.map((tile) => ({ colSpan: tile.smColSpan, rowSpan: 1 }));

/** DOM order the page renders tiles in; the plan must be a subsequence of it. */
const DOM_ORDER: GameHubTileId[] = [
  'season-summary',
  'next-match',
  'standings',
  'last-result',
  'rosters',
  'recent-results',
  'archives',
];

function expectedTiles(input: GameHubLayoutInput): GameHubTileId[] {
  const hasSeasonData = input.hasStandings || input.hasNextMatch || input.recentResultsCount > 0;
  const ids: GameHubTileId[] = [];
  if (!hasSeasonData) ids.push('season-summary');
  if (input.hasNextMatch) ids.push('next-match');
  if (input.hasStandings) ids.push('standings');
  if (input.recentResultsCount >= 1) ids.push('last-result');
  if (input.hasRosters) ids.push('rosters');
  if (input.recentResultsCount >= 2) ids.push('recent-results');
  ids.push('archives');
  return ids;
}

const allInputs: GameHubLayoutInput[] = [];
for (const hasStandings of [false, true]) {
  for (const hasNextMatch of [false, true]) {
    for (const recentResultsCount of [0, 1, 2, 3]) {
      for (const hasRosters of [false, true]) {
        allInputs.push({ hasStandings, hasNextMatch, recentResultsCount, hasRosters });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// packRowFlow — the model of CSS grid sparse auto-placement
// ---------------------------------------------------------------------------
describe('packRowFlow', () => {
  it('fills a row left to right', () => {
    const { placements, rows, holes } = packRowFlow(
      [
        { colSpan: 2, rowSpan: 1 },
        { colSpan: 1, rowSpan: 1 },
        { colSpan: 1, rowSpan: 1 },
      ],
      4
    );
    expect(placements.map((p) => [p.row, p.column])).toEqual([
      [0, 0],
      [0, 2],
      [0, 3],
    ]);
    expect(rows).toBe(1);
    expect(holes).toBe(0);
  });

  it('does not backfill: an item too wide for the rest of the row leaves a hole', () => {
    const { placements, holes } = packRowFlow(
      [
        { colSpan: 3, rowSpan: 1 },
        { colSpan: 2, rowSpan: 1 },
      ],
      4
    );
    expect(placements[1]).toMatchObject({ row: 1, column: 0 });
    // Row 0 column 3 is stranded, and row 1 columns 2-3 are left over at the end.
    expect(holes).toBe(3);
  });

  it('routes later items around a row-spanning item', () => {
    const { placements, holes } = packRowFlow(
      [
        { colSpan: 2, rowSpan: 2 },
        { colSpan: 1, rowSpan: 1 },
        { colSpan: 1, rowSpan: 1 },
        { colSpan: 2, rowSpan: 1 },
      ],
      4
    );
    expect(placements.map((p) => [p.row, p.column])).toEqual([
      [0, 0],
      [0, 2],
      [0, 3],
      [1, 2],
    ]);
    expect(holes).toBe(0);
  });

  it('detects the two states the old modulo sizing broke (regression)', () => {
    // State A: standings (2x2) + rosters (1) + archives sized by `filledCells % 4` = 3.
    expect(
      packRowFlow(
        [
          { colSpan: 2, rowSpan: 2 },
          { colSpan: 1, rowSpan: 1 },
          { colSpan: 3, rowSpan: 1 },
        ],
        4
      ).holes
    ).toBeGreaterThan(0);

    // State B: next match (2) + last result (1) + recent results (2) + archives (1).
    expect(
      packRowFlow(
        [
          { colSpan: 2, rowSpan: 1 },
          { colSpan: 1, rowSpan: 1 },
          { colSpan: 2, rowSpan: 1 },
          { colSpan: 1, rowSpan: 1 },
        ],
        4
      ).holes
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// planGameHubLayout — every reachable data state
// ---------------------------------------------------------------------------
describe('planGameHubLayout', () => {
  it('covers all 32 combinations of the input space', () => {
    expect(allInputs).toHaveLength(32);
  });

  it.each(allInputs)(
    'packs without holes: standings=$hasStandings nextMatch=$hasNextMatch results=$recentResultsCount rosters=$hasRosters',
    (input) => {
      const layout = planGameHubLayout(input);

      // The plan must describe exactly the tiles the page renders, in DOM order.
      expect(layout.map((tile) => tile.id)).toEqual(expectedTiles(input));
      const positions = layout.map((tile) => DOM_ORDER.indexOf(tile.id));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);

      for (const tile of layout) {
        expect(tile.colSpan).toBeGreaterThanOrEqual(1);
        expect(tile.colSpan).toBeLessThanOrEqual(DESKTOP_COLUMNS);
        expect([1, 2]).toContain(tile.rowSpan);
        expect([1, 2]).toContain(tile.smColSpan);
        expect(tile.smColSpan).toBeLessThanOrEqual(TABLET_COLUMNS);
      }

      const desktop = coverage(desktopSpans(layout), DESKTOP_COLUMNS);
      expect(desktop.empty).toBe(0);
      expect(desktop.overlapping).toBe(0);
      expect(desktop.outOfBounds).toBe(0);
      expect(desktop.rows).toBeGreaterThan(0);

      const tablet = coverage(tabletSpans(layout), TABLET_COLUMNS);
      expect(tablet.empty).toBe(0);
      expect(tablet.overlapping).toBe(0);
      expect(tablet.outOfBounds).toBe(0);

      // Mobile is a single column: everything stacks, so it can never hole.
      expect(coverage(desktopSpans(layout), 1).empty).toBe(0);
    }
  );

  it('is deterministic', () => {
    for (const input of allInputs) {
      expect(planGameHubLayout(input)).toEqual(planGameHubLayout(input));
    }
  });

  it('keeps the standings tile double-height when the data fills the grid', () => {
    const layout = planGameHubLayout({
      hasStandings: true,
      hasNextMatch: true,
      recentResultsCount: 3,
      hasRosters: true,
    });
    const byId = Object.fromEntries(layout.map((tile) => [tile.id, tile]));
    expect(byId['standings'].rowSpan).toBe(2);
    // The next-match tile is the dominant one: full width, first in the grid.
    expect(layout[0].id).toBe('next-match');
    expect(byId['next-match'].colSpan).toBe(DESKTOP_COLUMNS);
  });

  it('closes state A (standings only, no matches) without a dead quarter', () => {
    const layout = planGameHubLayout({
      hasStandings: true,
      hasNextMatch: false,
      recentResultsCount: 0,
      hasRosters: true,
    });
    expect(layout.map((tile) => [tile.id, tile.colSpan, tile.rowSpan])).toEqual([
      ['standings', 2, 2],
      ['rosters', 2, 1],
      ['archives', 2, 1],
    ]);
    expect(coverage(desktopSpans(layout), DESKTOP_COLUMNS).rows).toBe(2);
  });

  it('closes state B (per-player division with a scheduled match and results)', () => {
    const layout = planGameHubLayout({
      hasStandings: false,
      hasNextMatch: true,
      recentResultsCount: 2,
      hasRosters: false,
    });
    expect(layout.map((tile) => tile.id)).toEqual([
      'next-match',
      'last-result',
      'recent-results',
      'archives',
    ]);
    expect(coverage(desktopSpans(layout), DESKTOP_COLUMNS).empty).toBe(0);
  });

  it('gives the empty-season state a summary tile and a closing archives tile', () => {
    const layout = planGameHubLayout({
      hasStandings: false,
      hasNextMatch: false,
      recentResultsCount: 0,
      hasRosters: false,
    });
    expect(layout.map((tile) => tile.id)).toEqual(['season-summary', 'archives']);
    expect(coverage(desktopSpans(layout), DESKTOP_COLUMNS).empty).toBe(0);
  });
});
