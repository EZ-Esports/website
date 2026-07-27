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

/**
 * Mobile is `grid-cols-1` with no span classes applied at all: none of the
 * planned spans reach it. Modelling it as "the desktop spans in a 1-column
 * grid" was vacuous — `packRowFlow` clamps any colSpan to the column count, so
 * that assertion could not fail for any plan. What is actually worth pinning is
 * that mobile is a plain stack: one tile per row, in DOM order.
 */
const mobileStack = (layout: GameHubTileLayout[]) =>
  layout.map(() => ({ colSpan: 1, rowSpan: 1 }));

/** DOM order the page renders tiles in; the plan must be a subsequence of it. */
const DOM_ORDER: GameHubTileId[] = [
  'season-summary',
  'next-match',
  'standings',
  'last-result',
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
  if (input.recentResultsCount >= 2) ids.push('recent-results');
  ids.push('archives');
  return ids;
}

const allInputs: GameHubLayoutInput[] = [];
for (const hasStandings of [false, true]) {
  for (const hasNextMatch of [false, true]) {
    for (const recentResultsCount of [0, 1, 2, 3]) {
      allInputs.push({ hasStandings, hasNextMatch, recentResultsCount });
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
    // State A: standings (2x2) + a 1-column tile + archives sized by `filledCells % 4` = 3.
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
  it('covers all 16 combinations of the input space', () => {
    expect(allInputs).toHaveLength(16);
  });

  it.each(allInputs)(
    'packs without holes: standings=$hasStandings nextMatch=$hasNextMatch results=$recentResultsCount',
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

      // Mobile: every tile gets its own row, in DOM order, with nothing left over.
      const mobile = packRowFlow(mobileStack(layout), 1);
      expect(mobile.holes).toBe(0);
      expect(mobile.rows).toBe(layout.length);
      expect(mobile.placements.map((p) => p.row)).toEqual(layout.map((_, i) => i));
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
    });
    // Standings gives up its double height here: at 2x2 it strands the two
    // columns beside it, because archives is the only tile left to fill them
    // and one tile cannot cover two rows of a 2-wide gap.
    expect(layout.map((tile) => [tile.id, tile.colSpan, tile.rowSpan])).toEqual([
      ['standings', 2, 1],
      ['archives', 2, 1],
    ]);
    expect(coverage(desktopSpans(layout), DESKTOP_COLUMNS).rows).toBe(1);
  });

  it('closes state B (per-player division with a scheduled match and results)', () => {
    const layout = planGameHubLayout({
      hasStandings: false,
      hasNextMatch: true,
      recentResultsCount: 2,
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
    });
    expect(layout.map((tile) => tile.id)).toEqual(['season-summary', 'archives']);
    expect(coverage(desktopSpans(layout), DESKTOP_COLUMNS).empty).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The tablet (`sm`) grid — the breakpoint that used to be a no-op
// ---------------------------------------------------------------------------
describe('planGameHubLayout — tablet packing', () => {
  it('uses both tablet columns somewhere in the input space', () => {
    // Previously every tile was 2 columns wide in all 16 states, so
    // `sm:grid-cols-2` rendered as one column and the page's `sm:col-span-1`
    // class was unreachable. This is the assertion that would have caught it:
    // the old planner fails it, the new one passes.
    const halfWidth = allInputs.flatMap((input) =>
      planGameHubLayout(input).filter((tile) => tile.smColSpan === 1)
    );
    expect(halfWidth.length).toBeGreaterThan(0);
  });

  it('pairs the two small tiles side by side when they are DOM-adjacent', () => {
    // One completed result means no "recent results" list, so "last result"
    // and "archives" — the two tiles that read fine at ~300px — sit next to
    // each other and share a row instead of each taking the full width.
    const layout = planGameHubLayout({
      hasStandings: true,
      hasNextMatch: true,
      recentResultsCount: 1,
    });
    const byId = Object.fromEntries(layout.map((tile) => [tile.id, tile]));
    expect(byId['last-result'].smColSpan).toBe(1);
    expect(byId['archives'].smColSpan).toBe(1);

    const { placements } = packRowFlow(tabletSpans(layout), TABLET_COLUMNS);
    const last = placements[layout.findIndex((t) => t.id === 'last-result')];
    const archives = placements[layout.findIndex((t) => t.id === 'archives')];
    expect(last.row).toBe(archives.row);
    expect(last.column).toBe(0);
    expect(archives.column).toBe(1);
  });

  it('keeps the wide tiles full-width at tablet', () => {
    // A four-column standings table and the display-type hero do not survive
    // being halved, whatever the packer would prefer.
    for (const input of allInputs) {
      for (const tile of planGameHubLayout(input)) {
        if (['standings', 'next-match', 'recent-results', 'season-summary'].includes(tile.id)) {
          expect(tile.smColSpan).toBe(TABLET_COLUMNS);
        }
      }
    }
  });

  it('falls back to full width when a small tile has no partner', () => {
    // Three results puts "recent results" between "last result" and
    // "archives", so neither can halve without stranding a column.
    const layout = planGameHubLayout({
      hasStandings: true,
      hasNextMatch: true,
      recentResultsCount: 3,
    });
    expect(layout.every((tile) => tile.smColSpan === TABLET_COLUMNS)).toBe(true);
    expect(coverage(tabletSpans(layout), TABLET_COLUMNS).empty).toBe(0);
  });
});
