/**
 * The single rule for "may the public see this season's match outcomes?", plus
 * the pure redactors every public query applies when the answer is no.
 *
 * Pure (no DB, no `server-only`) so the rule and the redaction are unit-testable
 * and shared by server queries and client-facing copy. Redaction must happen on
 * the server, before data reaches a component: a number hidden by CSS or a
 * client-side `if` is still in the HTML and the RSC payload.
 *
 * Scope: only a season's `outcomes_finalized_at` decides. Staff views never
 * call these; they read the raw tables. The school manager portal is not
 * staff: its match list redacts through here (staff admins in the portal do not).
 */
/** Shown wherever a hidden season's standings, results or records would be. */
export const OUTCOMES_PENDING_NOTICE = 'Results will be published once the season is complete.';

/** What a team record reads as while the season's outcomes are hidden. */
export const OUTCOMES_PENDING_RECORD = 'Unpublished';

/**
 * Null/undefined = hidden. A missing season is also hidden: when we cannot say
 * the season was finalized, the safe answer is to publish nothing.
 */
export function areOutcomesPublic(
  season: { outcomesFinalizedAt?: Date | string | null } | null | undefined
): boolean {
  return Boolean(season?.outcomesFinalizedAt);
}

const STAT_KEYS = ['rank', 'wins', 'losses', 'gamesPlayed', 'winPct', 'points', 'notes'] as const;

/**
 * Neutral standings: every stat that reveals results (rank, record, win %,
 * points, notes that can carry "Total Points: ..." or the "Derived from match
 * results" marker) is nulled, and the list is re-sorted alphabetically so the
 * row order cannot encode the ranking either. Sorting happens here, before any
 * caller can slice a "top five", which would otherwise leak who is on top.
 */
export function redactStandingRows<
  T extends { schoolName: string; division: string; playerName?: string | null },
>(rows: readonly T[]): T[] {
  return rows
    .map((row) => {
      const copy: Record<string, unknown> = { ...row };
      for (const key of STAT_KEYS) if (key in copy) copy[key] = null;
      return copy as T;
    })
    .sort((a, b) => {
      const byName = (a.playerName ?? a.schoolName).localeCompare(b.playerName ?? b.schoolName);
      if (byName !== 0) return byName;
      const bySchool = a.schoolName.localeCompare(b.schoolName);
      return bySchool !== 0 ? bySchool : a.division.localeCompare(b.division);
    });
}

/**
 * A match with its outcome stripped: no scores, no MVP or free-text notes (both
 * can state the winner), and a forfeit reads as a plain completed match since
 * "forfeit" itself says who lost. Date, teams, division and the rest of the
 * status are kept so the schedule still works.
 */
export function redactMatchOutcome<
  T extends {
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    mvp?: string | null;
    notes?: string | null;
  },
>(match: T): T {
  const copy: T = { ...match, homeScore: null, awayScore: null };
  if (copy.status === 'forfeit') copy.status = 'completed';
  if ('mvp' in copy) copy.mvp = null;
  if ('notes' in copy) copy.notes = null;
  return copy;
}

/** Redacts only the matches whose season is not in `publicSeasonIds`. */
export function redactHiddenMatches<
  T extends {
    seasonId: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    mvp?: string | null;
    notes?: string | null;
  },
>(matches: readonly T[], publicSeasonIds: ReadonlySet<string>): T[] {
  return matches.map((m) => (publicSeasonIds.has(m.seasonId) ? m : redactMatchOutcome(m)));
}
