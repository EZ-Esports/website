# spec-026 — Manager season is resolved by name, not by "active"

**Status:** Implemented on branch `feat/schools-roster-view`, PR TBD. **Date:** 22 Oct 2026. **Scope:** `app/lib/onboarding/manager-auth.ts`, `portal-actions.ts`, hexagonal `PortalService` / repository port / adapter / `app/lib/db/onboarding-repository.ts`, `app/(portal)/portal` (page, header chip). No migration. **Supersedes** the "do not widen to inactive seasons" invariant of [spec-019](spec-019-manager-portal-season-scope.md) and the "dormant lock" note of [spec-020](spec-020-season-roster-lock.md).

## Why

spec-019 limited a manager to each game's ACTIVE season, so when staff activated a new season (or retired the manager's) the manager lost sight of their own school's data. A manager's affiliation already names a season (`school_managers.academic_year`, `YYYY-YY`); that name, not `seasons.is_active`, should decide what they work on.

## Rule

- For each game, the manager's season is the season of that game whose `name` equals the `academic_year` of one of their ACTIVE manager rows that covers the game (`managed_games` null/empty, or contains the game slug/id). Plain string equality on `YYYY-YY`; no conversion helpers.
- `seasons.is_active` no longer matters for manager access. A past, current or upcoming season all work if the name matches.
- **Multiple matches (decision):** when several rows match several seasons of the same game, the newest by name wins (`YYYY-YY` sorts lexicographically, so `2026-27` beats `2025-26`). This lives in one pure function, `resolveManagerSeason(affiliations, game, gameSeasons)` in `manager-auth.ts`; change the policy there only. A row that matches only an older season resolves to that older season (the newest season is then simply not the manager's).
- **No season with that name for the game:** the manager sees nothing for that game. Scopes omit it, reads are empty, and every mutation or game-filtered read is refused with `NO_MANAGED_SEASON_ERROR` ("Your season for this game does not exist yet; ask an EZ Esports admin to create it"). If no row covers the game at all the error is still `Forbidden: Not authorized for game ...` (checked first, so the existence of a season is not disclosed). The portal shows the "No Managed Season" card with matching wording when no game resolves.
- **Nothing else weakened:** school scoping, game coverage, roster -> team -> school anti-IDOR tracing, the ADMINISTRATOR bypass ordered before manager rows, and server-side enforcement are unchanged. A plain `staff_members` row still never grants the all-season view (spec-023). Staff admins still see every school, game and season (`getAuthorizedGameScopes` returns null).

## Where it applies

- `getAuthorizedGameScopes` returns one scope per game with `seasonId`, `seasonName`, `seasonIsActive`, `rostersLocked` of the resolved season.
- `assertManagerForSchool` / new `assertManagerForSchoolGame` (also returns the resolved season) / `assertManagerForRoster` (allowed when the roster's `team.seasonId` is the resolved season; other seasons refused with "belongs to a different season...").
- Reads (`getSchoolRosters`, `getSchoolPlayerPool`, invites) go through the scopes' season ids.
- `createSchoolRoster`: a manager creates in the resolved season (error if it does not exist, no fallback, no auto-creation); a staff admin still creates in the game's active season.
- `reviewPlayerInvite`: the default-roster lookup and lock check use the manager's resolved season (staff admins: the active season, as before).
- **Roster lock:** `assertSeasonRostersUnlocked` is applied to the RESOLVED season, so a locked past season stays locked for the manager, and a lock on a season the manager does not work in is irrelevant to them. This replaces spec-020's "lock goes dormant with the inactive season": locking an inactive season now takes effect for managers whose affiliation names it (the League Setup confirm dialog's "no manager effect until activated" wording is therefore stale; not changed here).
- Hexagonal path (unused by the app, kept consistent): `findSchoolRosters(..., {seasonName})`, `findRosterById` returns `seasonName` (replacing `isActiveSeason`), `isSeasonLockedByName(gameId, seasonName)` (replacing `isActiveSeasonLocked`); `PortalService` compares against `context.academicYear`.
- UI: the header shows `Season 2026-27`, plus a "Not the active season" chip when any resolved season is not its game's active one. `getActiveSeasonForGame` remains for staff-admin paths only.

## Still open

- Invites are not season-scoped (spec-019 gap unchanged): `player_invites` has no season column; managers see invites for games they manage, across seasons.
- A season rename in League Setup silently changes which manager rows match; there is no cross-check.

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests: `milestone3-portal-actions.test.ts` section 8 (rewritten: pure `resolveManagerSeason` incl. newest-wins; inactive season visible and editable; older-only row; no matching season -> empty and refused; two rows/seasons -> newest; per-game, other-school row, other-school roster, staff admin unchanged, plain staff row no all-season view, create/approve into the resolved inactive season), section 9 (lock applies to the resolved inactive season), `portal-service-season.test.ts`, `portal-service-lock.test.ts`. Not verified: the portal in a browser.
