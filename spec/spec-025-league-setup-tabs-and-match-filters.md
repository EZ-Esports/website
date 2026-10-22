# spec-025 — League Setup season tabs and Matches deep links

**Status:** Implemented on branch `feat/schools-roster-view` (not pushed, no PR yet). **Date:** 22 Oct 2026. **Scope:** `app/lib/admin-season-filters.ts` (pure helpers), `app/(admin)/admin/league/page.tsx` + `LeagueSetupClient.tsx`, `app/(admin)/admin/matches/page.tsx`, `app/components/admin/AdminMatchExplorer.tsx`. No migration, no permission changes.

## Context & Motivation

League Setup listed every season ever created in one stack, so the few current ones were buried among archived seasons. Staff also had no way to jump from a season to its fixtures.

## Design Decisions

- **Season tabs (League Setup).** `Active | Inactive | All` with counts, via `AdminFilterTabs` (URL-driven Links, `segmentedItem`). The selection lives in `?status=active|inactive|all`; the server page validates it (`parseSeasonStatus`, unknown -> Active) and passes it down, so reload and shared links work. Active carries no param. Counts always reflect all seasons. An empty tab shows the shared empty state. All per-season actions (lock, publish/hide, edit, delete) are unchanged and work on every tab. A season created or deactivated while on a tab it no longer matches disappears from that tab (switch tab to see it).
- **View matches link.** Every season row has an always-visible "View matches" chip-link to `/admin/matches?season=<seasonId>&game=<gameSlug>` (`seasonMatchesHref`).
- **Matches & Standings filters.** The explorer already filtered by game, season, division, status and search (server-driven via `fetchStaffMatchesPage`). New: game and season are read from `?game=<slug>&season=<id>` on the server (`parseMatchFilterParams`) so the first page is loaded already filtered, and written back with `history.replaceState` (no navigation, no refetch). Division, status, search and sort stay local state. Selecting a game already limited the season options.
- **Validation.** Unknown slugs, non-UUIDs and unknown ids are ignored. A season alone selects its game; a season that conflicts with the game wins. A game with no season param defaults to that game's active season when it has one; the explorer writes `season=all` when staff pick a game with "All seasons", so that choice survives reload. Plain `/admin/matches` is unchanged (all games, all seasons); the active-season default only applies once a game is chosen via the URL.
- **Invariants kept.** Both pages still authorize first (`getStaffForAdminSection`). Staff reads still use the raw `getMatchesPage` (spec-022); the filters only add `gameId` / `seasonId` params. Standings Archive untouched.

## Review follow-ups (22 Oct)

- **Season picked without a game.** The explorer's Season select now goes through `nextFiltersOnSeasonChange`: picking a season also sets its game, so the Game select, season option labels and the written URL agree immediately and match what a reload would show (`parseMatchFilterParams`: a season alone selects its game). "All seasons" keeps the current game (`season=all` behaviour unchanged).
- **Same-route navigation.** `useState(initialGameId/initialSeasonId)` is read once, so a sidebar click to plain `/admin/matches` or a "View matches" deep link while the explorer was mounted re-rendered the server page but left old filters and rows. The page now renders `<AdminMatchExplorer key={matchExplorerKey(gameId, seasonId)}>`, with the key derived only from the server-validated filters. When they change the explorer remounts with fresh state and first page; the `isFirstRender` ref is recreated, so the mount does not double-fetch. The explorer's own `history.replaceState` writes do not re-run the server page, so the props (and the key) do not change from them: no remount loop. The key deliberately excludes the first-page items, because `router.refresh()` after a score save would otherwise remount and wipe the division/status/search the user set. Known limitation: if staff change filters locally (URL rewritten by replaceState) and then follow a link whose validated filters equal what the server last rendered, the key is unchanged and local filters stay.
- **Season moved tabs.** After a create or an edit (the Active toggle; there is no separate row activate button), `seasonMovedHint` compares the saved `isActive` with the current tab. If the season no longer matches, the success toast appends "It is now under the Inactive/Active tab." with a visible "Show Inactive/Active" link (`AdminToast` gained an optional `action`). The toast lasts 9 s instead of 3.5 s when it carries a link. Nothing is hover-gated.

## Tests

`app/lib/__tests__/admin-season-filters.test.ts` (tab parsing, filtering, counts, hrefs, deep link href, URL param parsing and validation, write-back round trip); `match-actions-gating.test.ts` gained cases that staff reads with game/season filters stay on the raw query and ignore malformed ids.

`app/lib/__tests__/admin-season-ux.test.tsx`: tab membership and moved hint, season-picks-game (including agreement with `parseMatchFilterParams`), explorer key stability/change, and `renderToStaticMarkup` of `AdminFilterTabs` and `AdminToast` with and without the action link.

## Not verified

Not exercised in a browser (the admin requires sign-in); the follow-ups above were not viewed in a browser either. The remount-on-navigation and no-loop behaviour is reasoned from Next's behaviour and covered only at the key-function level, not by a DOM test.
