/**
 * Layout planner for the game hub's bento grid.
 *
 * Pure module — no React, no DB, no Tailwind — so it can be unit-tested against
 * every data state the hub can reach.
 *
 * Why a planner and not arithmetic: CSS grid's default auto-placement is
 * *sparse* row flow. It never backfills a cell it has already stepped past, and
 * a row-spanning tile reserves cells in the following row. So "cells consumed
 * so far" tells you nothing about how many columns are contiguously free at the
 * flow cursor — the only reliable way to know whether a set of spans leaves a
 * hole is to run the placement algorithm. `packRowFlow` is that algorithm;
 * `planGameHubLayout` searches the small space of allowed spans and returns the
 * cheapest combination that packs with zero holes.
 */

export type GameHubTileId =
  | 'season-summary'
  | 'next-match'
  | 'standings'
  | 'last-result'
  | 'rosters'
  | 'recent-results'
  | 'archives';

/** The data facts the layout depends on — everything else is presentation. */
export interface GameHubLayoutInput {
  hasStandings: boolean;
  hasNextMatch: boolean;
  /** Completed matches available; the first becomes "last result", the rest "recent results". */
  recentResultsCount: number;
  hasRosters: boolean;
}

export interface GameHubTileLayout {
  id: GameHubTileId;
  /** Columns spanned on the 4-column desktop grid (1-4). */
  colSpan: number;
  /** Rows spanned on the desktop grid (1-2). */
  rowSpan: number;
  /** Columns spanned on the 2-column tablet grid (1-2). Always 1 row. */
  smColSpan: number;
}

/** Columns in the desktop (`lg`) grid. */
export const DESKTOP_COLUMNS = 4;
/** Columns in the tablet (`sm`) grid. */
export const TABLET_COLUMNS = 2;

interface Span {
  colSpan: number;
  rowSpan: number;
}

interface Placement extends Span {
  row: number;
  column: number;
}

export interface PackResult {
  placements: Placement[];
  /** Number of grid rows the placement occupies. */
  rows: number;
  /** Empty cells inside those rows. Zero is the only acceptable value. */
  holes: number;
}

/**
 * Simulates CSS grid sparse auto-placement (`grid-auto-flow: row`, *not* dense)
 * over a fixed column count, and reports how many cells are left empty inside
 * the resulting block of rows.
 */
export function packRowFlow(items: readonly Span[], columns: number): PackResult {
  const occupied: boolean[][] = [];
  const rowAt = (row: number): boolean[] => {
    while (occupied.length <= row) occupied.push(new Array<boolean>(columns).fill(false));
    return occupied[row];
  };
  const isFree = (row: number, column: number, colSpan: number, rowSpan: number): boolean => {
    for (let r = row; r < row + rowSpan; r += 1) {
      const cells = rowAt(r);
      for (let c = column; c < column + colSpan; c += 1) {
        if (cells[c]) return false;
      }
    }
    return true;
  };

  const placements: Placement[] = [];
  // The auto-placement cursor only ever moves forward — this is what makes
  // "leftover cells" un-reclaimable and holes possible.
  let cursorRow = 0;
  let cursorColumn = 0;

  for (const item of items) {
    const colSpan = Math.min(Math.max(item.colSpan, 1), columns);
    const rowSpan = Math.max(item.rowSpan, 1);
    let row = cursorRow;
    let column = cursorColumn;
    if (column + colSpan > columns) {
      row += 1;
      column = 0;
    }
    while (!isFree(row, column, colSpan, rowSpan)) {
      column += 1;
      if (column + colSpan > columns) {
        row += 1;
        column = 0;
      }
    }
    for (let r = row; r < row + rowSpan; r += 1) {
      const cells = rowAt(r);
      for (let c = column; c < column + colSpan; c += 1) cells[c] = true;
    }
    placements.push({ row, column, colSpan, rowSpan });
    cursorRow = row;
    cursorColumn = column + colSpan;
  }

  const rows = placements.reduce((max, p) => Math.max(max, p.row + p.rowSpan), 0);
  let holes = 0;
  for (let r = 0; r < rows; r += 1) {
    for (const filled of rowAt(r)) if (!filled) holes += 1;
  }
  return { placements, rows, holes };
}

interface TileCandidate {
  id: GameHubTileId;
  /** Allowed spans, most-preferred first. */
  variants: Span[];
  /** How much this tile resists being reshaped: higher = deform something else. */
  weight: number;
}

/**
 * Which tiles the page renders, in DOM order, for a given data state.
 *
 * `season-summary` appears exactly when the division has nothing renderable —
 * whether or not a season is on record. There is one grid for every state.
 */
function buildCandidates(input: GameHubLayoutInput): TileCandidate[] {
  const { hasStandings, hasNextMatch, recentResultsCount, hasRosters } = input;
  const hasSeasonData = hasStandings || hasNextMatch || recentResultsCount > 0;
  const candidates: TileCandidate[] = [];

  if (!hasSeasonData) {
    candidates.push({
      id: 'season-summary',
      variants: [
        { colSpan: 2, rowSpan: 1 },
        { colSpan: 4, rowSpan: 1 },
        { colSpan: 3, rowSpan: 1 },
      ],
      weight: 2,
    });
  }
  if (hasNextMatch) {
    // The dominant tile: full width at the top of the grid whenever that packs.
    candidates.push({
      id: 'next-match',
      variants: [
        { colSpan: 4, rowSpan: 1 },
        { colSpan: 2, rowSpan: 1 },
        { colSpan: 3, rowSpan: 1 },
      ],
      weight: 3,
    });
  }
  if (hasStandings) {
    candidates.push({
      id: 'standings',
      variants: [
        { colSpan: 2, rowSpan: 2 },
        { colSpan: 2, rowSpan: 1 },
        { colSpan: 4, rowSpan: 1 },
        { colSpan: 3, rowSpan: 1 },
      ],
      weight: 3,
    });
  }
  if (recentResultsCount >= 1) {
    candidates.push({
      id: 'last-result',
      variants: [
        { colSpan: 1, rowSpan: 1 },
        { colSpan: 2, rowSpan: 1 },
      ],
      weight: 1,
    });
  }
  if (hasRosters) {
    candidates.push({
      id: 'rosters',
      variants: [
        { colSpan: 1, rowSpan: 1 },
        { colSpan: 2, rowSpan: 1 },
      ],
      weight: 1,
    });
  }
  if (recentResultsCount >= 2) {
    candidates.push({
      id: 'recent-results',
      variants: [
        { colSpan: 2, rowSpan: 1 },
        { colSpan: 3, rowSpan: 1 },
        { colSpan: 4, rowSpan: 1 },
      ],
      weight: 2,
    });
  }
  // Always present, and the most elastic tile: it closes the grid, so it takes
  // whatever width the rows above leave for it.
  candidates.push({
    id: 'archives',
    variants: [
      { colSpan: 4, rowSpan: 1 },
      { colSpan: 3, rowSpan: 1 },
      { colSpan: 2, rowSpan: 1 },
      { colSpan: 1, rowSpan: 1 },
    ],
    weight: 1,
  });

  return candidates;
}

const lexicographicallyLess = (a: readonly number[], b: readonly number[]): boolean => {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
};

/**
 * Exhaustive (but tiny — at most a few hundred combinations) search for the
 * cheapest set of spans that packs without holes. Falls back to one full-width
 * tile per row, which is hole-free by construction, if nothing else fits.
 */
function chooseSpans(candidates: readonly TileCandidate[], columns: number): Span[] {
  const indices = new Array<number>(candidates.length).fill(0);
  let bestCost = Number.POSITIVE_INFINITY;
  let bestIndices: number[] | null = null;

  const walk = (depth: number, cost: number): void => {
    if (cost > bestCost) return; // cost only grows as we descend
    if (depth === candidates.length) {
      const spans = candidates.map((candidate, i) => candidate.variants[indices[i]]);
      if (packRowFlow(spans, columns).holes !== 0) return;
      // Ties are broken toward the earlier (more preferred) variant list.
      if (bestIndices === null || cost < bestCost || lexicographicallyLess(indices, bestIndices)) {
        bestCost = cost;
        bestIndices = [...indices];
      }
      return;
    }
    const candidate = candidates[depth];
    for (let i = 0; i < candidate.variants.length; i += 1) {
      indices[depth] = i;
      walk(depth + 1, cost + i * candidate.weight);
    }
    indices[depth] = 0;
  };

  walk(0, 0);

  const picked: number[] | null = bestIndices;
  if (picked === null) return candidates.map(() => ({ colSpan: columns, rowSpan: 1 }));
  return candidates.map((candidate, i) => candidate.variants[picked[i]]);
}

/**
 * Plans the hub grid for a data state: an ordered list of tile descriptors
 * whose spans are guaranteed to fill every cell of both the desktop and the
 * tablet grid.
 */
export function planGameHubLayout(input: GameHubLayoutInput): GameHubTileLayout[] {
  const candidates = buildCandidates(input);
  const desktop = chooseSpans(candidates, DESKTOP_COLUMNS);

  // The tablet grid never row-spans (the page applies `row-span` at `lg` only),
  // so it is planned separately: start from the desktop width, clamped to two
  // columns, and allow a one-column tile to widen if that is what closes a gap.
  const tabletCandidates: TileCandidate[] = candidates.map((candidate, i) => {
    const base = Math.min(desktop[i].colSpan, TABLET_COLUMNS);
    return {
      id: candidate.id,
      variants:
        base === 1
          ? [
              { colSpan: 1, rowSpan: 1 },
              { colSpan: 2, rowSpan: 1 },
            ]
          : [{ colSpan: 2, rowSpan: 1 }],
      weight: 1,
    };
  });
  const tablet = chooseSpans(tabletCandidates, TABLET_COLUMNS);

  return candidates.map((candidate, i) => ({
    id: candidate.id,
    colSpan: desktop[i].colSpan,
    rowSpan: desktop[i].rowSpan,
    smColSpan: tablet[i].colSpan,
  }));
}
