/**
 * Form-guide derivation for the game hub's standings tile.
 *
 * Pure module — no React, no DB, no Tailwind — so every data state a season can
 * reach is unit-testable (see `app/lib/__tests__/game-hub-form.test.ts`), the
 * same split `app/lib/game-hub-layout.ts` uses.
 *
 * The division filtering, the soft-delete exclusion and the per-school cap all
 * happen in SQL (`buildFormGuideQuery`), because those are the parts that
 * decide how many rows come back. What stays here is the judgment SQL should
 * not be making: what a pair of scores means, which end of the strip is recent,
 * and what to do when there is nothing to show.
 *
 * The one rule this module exists to enforce: **absence is a real answer.** A
 * season whose standings come from the `season_standings` snapshot (archived or
 * imported seasons, which have final tables but no per-match rows) has no form
 * to show, and a school three matches into its season has three. Neither may be
 * padded out to five — an empty guide must stay empty rather than render as
 * five losses or five zeros.
 */

/** A decided match outcome for one school. Draws are not represented — see `buildFormGuide`. */
export type FormOutcome = 'W' | 'L';

/**
 * One match as played by *one* school — the shape `buildFormGuideQuery` returns.
 *
 * A match produces two of these, one per side, and each carries that side's own
 * `scored`/`conceded` so nothing downstream has to know which end of the fixture
 * it is reading. `school` is the **school-name string**, not an id: the standings
 * rows these guides line up against carry the school name and nothing else —
 * they come from the `season_standings` snapshot as often as from match rows —
 * so the name is the only key both sides share. A row whose school or scores are
 * missing is skipped rather than guessed at.
 */
export interface FormEntry {
  /**
   * The match id, used only to break ties. Bulk-imported seasons default every
   * unknown kickoff to one timestamp, so without a second key a school's chips
   * can come back in a different order between two identical requests.
   */
  id: string;
  school: string | null;
  scored: number | null;
  conceded: number | null;
  /** Used only to order the guide; any Date-parseable value works. */
  scheduledAt: Date | string | number;
}

/** Matches per guide — the standard five-match form guide. */
export const FORM_LENGTH = 5;

const timeOf = (entry: FormEntry): number => {
  const time = new Date(entry.scheduledAt).getTime();
  // An unparseable date sorts oldest rather than throwing off every comparison
  // it takes part in (NaN comparisons are all false, which breaks the sort).
  return Number.isNaN(time) ? 0 : time;
};

/** Newest first, ties broken on id — the same order the SQL partition uses. */
const byRecency = (a: FormEntry, b: FormEntry): number => {
  const byTime = timeOf(b) - timeOf(a);
  if (byTime !== 0) return byTime;
  return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
};

/**
 * Last `length` decided matches per school, **oldest first** — the standard
 * form-guide reading order, most recent on the right.
 *
 * Input order does not matter: the guide is ordered from `scheduledAt` and `id`
 * here, so callers cannot silently break it by changing a query's `ORDER BY`,
 * and two requests over the same rows produce the same strip even when every
 * kickoff time in the season is identical.
 *
 * Only schools with at least one decided match appear in the map at all. A
 * caller reading a missing school gets "no form", which is exactly the truth
 * for snapshot-standings seasons.
 *
 * Drawn matches (equal scores) are skipped entirely rather than being counted
 * against one side: a tie is neither a W nor an L, and inventing one would be
 * the fabrication this module is here to prevent.
 */
export function buildFormGuide(
  entries: readonly FormEntry[],
  length: number = FORM_LENGTH
): Map<string, FormOutcome[]> {
  const guides = new Map<string, FormOutcome[]>();
  if (length < 1) return guides;

  for (const entry of [...entries].sort(byRecency)) {
    if (!entry.school) continue;
    if (entry.scored === null || entry.conceded === null) continue;
    if (entry.scored === entry.conceded) continue;
    const outcomes = guides.get(entry.school) ?? [];
    // Newest-first while filling, so the cap keeps the most recent matches.
    if (outcomes.length >= length) continue;
    outcomes.push(entry.scored > entry.conceded ? 'W' : 'L');
    guides.set(entry.school, outcomes);
  }

  for (const outcomes of guides.values()) outcomes.reverse();
  return guides;
}

/**
 * Screen-reader sentence for a guide, e.g. "Form, oldest to newest: won, won,
 * lost." The chips themselves are five bare letters, which a screen reader
 * would otherwise read as "W W L W W" with no indication of what they are or
 * which end is recent.
 */
export function describeFormGuide(outcomes: readonly FormOutcome[]): string {
  if (outcomes.length === 0) return 'Recent form not available.';
  const words = outcomes.map((outcome) => (outcome === 'W' ? 'won' : 'lost'));
  return `Form, oldest to newest: ${words.join(', ')}.`;
}
