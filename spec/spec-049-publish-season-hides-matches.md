# spec-049 - Publish season hides matches

**Status:** Implemented on branch `publish-season-gating` (not merged). **Date:** 29 Oct 2026. **Builds on:** [spec-022](spec-022-hide-season-outcomes.md). **Migration:** none (the `seasons.outcomes_finalized_at` column keeps its name).

## Context

spec-022 hid scores, standings and records of an unpublished season but still listed its matches (as "0 - 0"), so a freshly generated schedule showed on the competition tab before staff were ready. The flag now means "season is public": every public read of a season's matches, scheduled or played, requires it.

## Decisions

- **Rename (user-facing only):** "Publish results" -> "Publish season", "Hide results" -> "Unpublish season", chips "Season published / unpublished", toasts "Season published." / "Season unpublished.". Server action names (`publishSeasonOutcomes`, `hideSeasonOutcomes`) and the column are unchanged.
- **Gating (server-side, in the data layer):**
  - `getPublicMatchesPage` -> `getMatchesPage(params, true)`: `facetConditions` adds `seasons.outcomes_finalized_at IS NOT NULL` in SQL so keyset paging and `nextCursor` stay exact. This also covers the public `fetchMatchesPage` action (client `seasonId` still untrusted).
  - `getPublicSeasonMatches` returns `[]` unless the season is in `getOutcomesPublicSeasonIds()`.
  - `/[game]/schedule` skips both queries for an unpublished season and renders `SCHEDULE_PENDING_NOTICE` instead of the calendar/list.
  - `getGameHubData` leaves `nextMatch` null while the active season is unpublished (previously a leak: the Next match tile was not redacted).
  - `getArchiveIndex` reports `matchCount: 0` for unpublished seasons.
  - Already gated by spec-022 and unchanged: standings, hub standings/recent results, team records, homepage Latest Results.
- **Staff views untouched:** `getMatchesPage` (default `publicOnly = false`), `getStaffMatches`, `fetchStaffMatchesPage`, `getMatchTabCounts`.
- **Cache invalidation:** the toggle already runs `updateTag` for `games`, `seasons`, `teams`, `matches`, `rosters` and `revalidatePath` for hub, standings, schedule, teams, `/archives` and `/`. The public match reads are uncached, and the season list (carrying `outcomesPublic`) sits behind `seasons`, so matches appear/disappear on the next request.
- **Not gated:** the school manager portal match list (`getSchoolMatchRows`, authenticated; scores still redacted per spec-022) and tournament (bracket) matches.

## Verification

`npx tsc --noEmit`, `npx vitest run`, eslint. Tests: `app/lib/db/__tests__/season-outcomes-gating.test.ts`.
