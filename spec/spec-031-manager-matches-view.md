# spec-031: Manager Portal Matches View

- **Spec ID:** spec-031
- **Title:** Read-only "Matches" section in the school manager portal
- **Status:** In Progress (code, tests, lint and build pass; not visually verified, see Verification)
- **PR / Commit:** branch `feat/manager-matches-view`, PR TBD (also carries the rules 4.3 rewrite)
- **Date:** 2026-10-24
- **Scope:** `/portal` UI and one new query. No migration, no schema change. Part 1 of [#274](https://github.com/EZ-Esports/website/issues/274) (supersedes [#254](https://github.com/EZ-Esports/website/issues/254)); reschedule requests are PR 2.

## Context & Motivation

A match already stores a home and an away roster and every roster belongs to a team and a school, so a school's matches need no new data. Managers had no way to see who their school plays or when.

## Design Decisions

- **Visibility:** a match is visible to both schools' managers as soon as staff create it. There is no draft state (decided 24 Oct).
- **Query:** `getSchoolMatchRows` (`app/lib/db/matches.ts`) joins matches to season, game and both sides' roster, team and school, and matches when the school is on either side. Matches against a soft-deleted school are excluded, like the other match queries. Ordered oldest first; uncached (the portal's other reads are uncached too).
- **Scoping:** `getSchoolMatches` (`portal-actions.ts`) reuses `resolveManagerScope`. A manager sees only each managed game's resolved season (matched by name, spec-026), including an inactive/view-only season (spec-028); no resolved season returns an empty list without querying. A staff admin (`scopes === null`) sees every season.
- **Outcomes:** for managers, rows pass through `redactHiddenMatches` with `getOutcomesPublicSeasonIds`, so scores and the forfeit flag are removed server-side until staff publish the season (spec-022). Staff admins see raw rows. The `season-outcomes.ts` header now says the manager portal is a redacting consumer.
- **Shaping:** `app/lib/school-matches.ts` (pure): `toSchoolMatchItem` gives the opponent, home/away and own/opponent score from the school's side; `splitSchoolMatches` reuses `matchTabOf` so Upcoming = live or scheduled and not yet started (soonest first) and Past = everything else (newest first), including an overdue scheduled match, shown as "Awaiting result".
- **UI:** `MatchesSection` after the rosters, RAC `Tabs` (in-page panel switching) with Upcoming and Past, a table like the invites history (When in Eastern Time with an "ET" label via `formatNY`, Opponent with Home/Away, Division, Game when the list spans several games, Status, and Result on Past). It follows the page's game filter client-side like rosters and invites. When a list spans several seasons of one game (staff admins only) the season name shows under the division. Tab panels carry a visible focus ring because they are a tab stop.
- **Clock:** the Upcoming/Past split uses a server-provided `matchesNowIso`, never the browser clock, so SSR and hydration agree.

## Invariants & Boundaries

- Read-only: no mutation, no cache tag written.
- Redaction happens before the rows reach any component; do not move it client-side.
- Non-goals (PR 2): reschedule requests, the requests table, the staff queue, notifications.

## Verification

- `app/lib/__tests__/school-matches.test.ts`: side orientation, the Upcoming/Past split (incl. live, overdue, exact-now), status labels, `getSchoolMatches` authorization, no-season short circuit, manager season restriction with redaction, and the unredacted staff-admin path. `tour/__tests__/anchors.test.tsx` renders the new section.
- `tsc --noEmit`, `vitest run` (1716 passed), `npm run lint` (no errors) and `npm run build` pass.
- The SQL itself (either-side match, season/game filters, soft-delete exclusion) is covered only by review and the build, not by a test; no local database was available.
- Not done: a visual check at desktop and 400px. It needs a local Postgres with an explicit `DATABASE_URL` (never `.env`) and a manager login.
