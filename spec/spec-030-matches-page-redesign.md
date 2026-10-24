# spec-030: Matches Page Redesign

- **Spec ID:** spec-030
- **Title:** Staff Matches page: status tabs with server counts, day-grouped rows, inline result entry, schedule dialog
- **Status:** In Progress (code complete; not visually verified, see Verification)
- **PR / Commit:** branch `feat/matches-page-redesign`, PR TBD
- **Date:** 2026-10-23
- **Scope:** `/admin/matches` UI and query layer. No migration, no schema change.

## Context & Motivation

The page was congested: a permanent sticky schedule-form column, six filter controls, and 25 always-open inline editor rows in a table. Staff's job there is mostly "enter the result of matches that were played", so that work queue should be the first thing they see, and scheduling a match is an occasional action that does not deserve a permanent column. Design reference was an approved interactive mock (layout and hierarchy only; implemented with the real admin primitives).

The nav label also said "Matches & Standings" although standings are not shown there (they live in Standings Archive and public pages). The label is now "Matches".

## Design Decisions

- **Header:** `AdminPageHeader` (eyebrow = League Operations, h1 = Matches). Primary "Schedule match" opens `ScheduleMatchDialog` (ui `overlay.tsx` Overlay/Modal/Dialog) around the unchanged `MatchScheduleForm` (same `createMatch`, `parseEastern`, validation). On success the dialog closes, a toast shows, and page 1 plus totals reload.
- **Filters:** Game, Season (all seasons, "(current)" on active) and search stay visible. Division and Sort sit behind a "More filters" disclosure (`aria-expanded`) with a dot when either is non-default. URL behaviour from spec-025 is untouched (`parseMatchFilterParams`, `writeFilter` via `history.replaceState`, `fetchSeq`/stale/retry, "Load 25 more" cursor).
- **Tabs (server-side):** `needs-results`, `upcoming`, `completed`, `all` (`MatchTab` in `db/match-page.ts`).
  - Needs results: `status = scheduled AND scheduledAt < now`.
  - Upcoming: `status = live OR (scheduled AND scheduledAt >= now)`.
  - Completed: `completed | forfeit | cancelled`.
  - "Past" is a UTC instant comparison with the server clock (`now` is never taken from the client). The pure `matchTabOf` / `matchInTab` and the SQL `matchTabCondition` mirror each other.
  - `getMatchesPage` takes `tab` (+ optional `now`); the tab is combined with the keyset cursor, so pagination stays correct per tab.
  - **Counts** come from `getMatchTabCounts` (one `count(*) FILTER (WHERE ...)` aggregate over the same joins and facets: game, season, division, search; not tab/sort/cursor), exposed via staff-guarded `fetchStaffMatchTabCounts` (`getStaffForAdminSection('/admin/matches')`). They are refetched together with page 1 only when `matchCountsKey` changes (a tab or sort change keeps them), and refreshed after a save, delete or schedule.
  - **Default sort per tab:** Needs results / Upcoming oldest first, Completed / All newest first (`defaultSortForTab`); the Sort control's "Default for tab" follows it, an explicit pick overrides.
- **Default tab:** `defaultMatchTab(searchParams)`: `from=league` or a `season` param (other than the explorer's own `season=all`) opens "All"; a plain visit opens "Needs results". The server page loads the first page and counts for that tab; the client adopts them (and resets the tab) on link navigation, like the other facets. The tab itself is local state, not in the URL.
- **Rows:** read-only, grouped under Eastern-time day headings (`groupMatchesByDay`, `formatNY`; never browser-local dates). Time, teams (winner bold when scored), division (plus game/season when scope is "All seasons"), score, status chip ("Needs result" for overdue scheduled). "Enter result" (primary when overdue) or "Edit" expands the editor for that row only: two scores, status, Save result / Cancel, reusing `updateMatchScore` and the client guard (completed/forfeit need both scores). Overflow menu (RAC Menu): "Mark cancelled" (same `updateMatchScore` path, keeps scores) and "Delete match…" which opens the shared, controlled `ConfirmDeleteButton` dialog (deletion stays explicit and confirmed).
- **After a save:** `applySavedMatch` patches the row and drops it if it no longer belongs to the open tab, then totals refresh, so a saved result leaves "Needs results" and the counts move.
- **Accessibility:** RAC Tabs (arrow keys), per-row aria labels, `aria-expanded` on Edit, focus to the first score on open and back to the row's Edit button (or the list) on close/save, Escape closes the editor, 44px targets under `sm`, no animation beyond the shared `admin-*` classes (which reduced motion disables). Mobile layout stacks time/status, teams, actions; the tab list scrolls inside its own container, never the page.

## Invariants & Boundaries

- Staff reads stay the raw `getMatchesPage` / `getMatchTabCounts`; the public action `fetchMatchesPage` strips `tab` as well as `status` (a Completed filter on a hidden season would leak outcomes, spec-022).
- Tab and counts are never computed by filtering loaded rows client-side.
- `ConfirmDeleteButton` gained an optional controlled mode (`open`/`onOpenChange`, no built-in trigger); existing icon usage unchanged.
- Non-goals: URL-persisted tab, bulk actions, standings on this page, schema changes.

## Verification

- `npx tsc --noEmit` and `npx vitest run` (new `app/lib/__tests__/match-tabs.test.ts`; extended `match-actions-gating.test.ts` and `admin-season-ux.test.tsx`).
- Visual check needs a local Postgres with explicit `DATABASE_URL` (never `.env`): open `/admin/matches` at desktop and 400px, confirm no horizontal scroll, tab counts vs paging, save moves a row out of Needs results. Not done in the authoring session (no local database).
