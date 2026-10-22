# spec-022 — Hide season outcomes until staff publish them

**Status:** Shipped. Migration `0051` applied to production 18 Oct 2026 (backup of `seasons` first; 11 inactive seasons stamped, 4 active left hidden). **PR:** #261 (issue #228). **Date:** 18 Oct 2026. **Scope:** `seasons.outcomes_finalized_at` (migration `0051`), `app/lib/season-outcomes.ts`, `app/lib/db/{standings,matches,league,match-page}.ts`, `app/lib/match-actions.ts`, public standings / schedule / game hub / team pages / homepage / archives, Admin -> League Setup.

**Deploy order:** apply `0051` to production (after a backup) **before** the code deploys. Every `db.select().from(schema.seasons)` selects the new column, so the code without the column breaks the whole site (same hazard as `0050`).

## Context & Motivation

Historical imports were schedule-only and in-progress seasons have partial results, so the public site published incomplete or misleading scores, records and champions (see the open thread "Historical match scores were never complete"). Staff now decide, per season, when results go public.

## Design Decisions

- **Data:** nullable `seasons.outcomes_finalized_at timestamp`. Null = outcomes HIDDEN publicly; set = visible. Migration `0051` (hand-written like `0047`-`0050`; snapshots stop at `0042`) adds the column and **backfills `now()` for every season with `is_active = false`**, so archived seasons keep showing results; active seasons start hidden.
- **One rule:** `areOutcomesPublic(season)` in `app/lib/season-outcomes.ts` (pure, fails closed on null/missing). The same module holds the pure redactors: `redactStandingRows`, `redactMatchOutcome`, `redactHiddenMatches`, and the copy constants (`OUTCOMES_PENDING_NOTICE`).
- **Server-side only:** redaction happens in the data layer, before props reach a component, so hidden numbers are never in the HTML or RSC payload. Components only choose copy.
- **Staff toggle:** `publishSeasonOutcomes(seasonId)` / `hideSeasonOutcomes(seasonId)` in `app/(admin)/admin/league/actions.ts`, `MANAGE_LEAGUE`, idempotent, `updateTag` for `games`, `seasons`, `teams`, `matches`, `rosters` plus `revalidatePath` for the public hub/standings/schedule/teams routes and `/archives`. League Setup shows a "Results public / hidden" chip and a "Publish results / Hide results" button with a confirm dialog beside the roster lock. There is no audit table in this repo (the roster lock has none either), so the only record is the timestamp.

### What each public surface does when hidden

| Surface | Behavior |
| --- | --- |
| `/[game]/standings` | `getSeasonStandingsFor` returns rows with rank, wins, losses, games, win %, points and notes nulled and sorted alphabetically (by player name for individual games). Table shows Team only (or Player, School); no medals, no Record/Win %/Games; notice "Results will be published once the season is complete."; lead reads "Teams competing this season" / "Teams from the X season"; "Reconstructed" and "Final standings imported" captions hidden. |
| Game hub standings tile | `getGameSeasonSummary` lists **every** team alphabetically (no "top five", since which five survive a cut would reveal the ranking), with no rank, W-L, Win % or Form, titled "<Division> teams", with the notice. Recent-results and last-result tiles disappear (the layout planner sees zero results). |
| Team pages (`getGameTeamsPageData`, `getSchoolGameTeamsPageData`) | `getTeamStandingsRecords` skips hidden seasons (snapshot and computed), so the existing "Record: Unpublished" shows. |
| `/[game]/schedule` | `getPublicSeasonMatches` / `getPublicMatchesPage` null scores, MVP and notes for matches of hidden seasons and turn `forfeit` into `completed`; the calendar badge and archive list show a plain "Completed"; date, teams and time are kept; notice under the heading. |
| `fetchMatchesPage` server action | Public and redacting per match season (looked up server-side; the client `seasonId` is not trusted); ignores `status` so forfeits cannot be probed. The admin list now calls the new `fetchStaffMatchesPage`, which requires access to `/admin/matches` (the shared action previously had no auth). |
| Homepage League Pulse | `getCachedRecentResults` league rows require a finalized season (tournament matches are unaffected; they have no season gate). |
| `/archives` | `getArchiveIndex` shows no champion for a hidden season. |

## Invariants & Boundaries

- Staff/portal reads (`getMatchesPage`, `getSeasonStandingsForEditor`, `getCachedRosters`, `getStaffMatches`, `getCachedMatches`) stay raw. New public reads of scores or standings must go through the gated functions above.
- `getSeasonsWithGames` (cached, tag `seasons`) exposes only the boolean `outcomesPublic`, not the timestamp (a Date would round-trip through the cache as a string).
- Unknown season = hidden.
- Non-goals: tournament (bracket) games and `tournament_matches` are not gated; deactivating a season publishes it (`retireSeasonSet` in `app/lib/db/league.ts` coalesces `outcomes_finalized_at` to `now()` for an explicit deactivate and for the auto-retire when another season is activated or created; staff can still Hide it afterwards); match-level or division-level publication.

## Verification

`npx tsc --noEmit`, `npx vitest run`, eslint on touched files. Tests: `app/lib/__tests__/season-outcomes.test.ts` (rule and redactors), `app/lib/db/__tests__/season-outcomes-gating.test.ts` (standings, hub summary, team records, public matches against a mocked db), `app/lib/__tests__/match-actions-gating.test.ts` (public vs staff actions), `league/__tests__/season-outcomes-actions.test.ts`, `db/__tests__/season-outcomes-migration.test.ts`. Local DB: `DATABASE_URL=<local> node node_modules/drizzle-kit/bin.cjs migrate`, then `select is_active, count(*), count(outcomes_finalized_at) from seasons group by 1`. Not verified in a browser.
