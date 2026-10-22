# spec-028 — Past seasons are view-only for school managers

**Status:** Implemented on branch `feat/schools-roster-view`, PR TBD. **Date:** 22 Oct 2026. **Scope:** `app/lib/season-name.ts` (the rule), `app/lib/onboarding/manager-auth.ts`, `portal-actions.ts`, hexagonal `PortalService` / repository port / adapter / `app/lib/db/onboarding-repository.ts`, `app/(portal)/portal` (page, header chip, banner and disabled controls). No migration. **Builds on** [spec-026](spec-026-manager-season-by-name.md) (season by name) and [spec-020](spec-020-season-roster-lock.md) (lock).

## Why

spec-026 let a manager keep working in the season named by their affiliation even after staff activated a newer one. That kept their data visible, but also let them edit a finished season. A season that is over should be a read-only record for managers.

## Rule: what is a "past" season

One pure function, `isPastSeason(season, gameSeasons)` in `app/lib/season-name.ts`. Change the policy there and nowhere else (the server guards, the scopes, the DAL and the hexagonal path all call it). `gameSeasons` are all seasons of the same game. Names are `YYYY-YY`, which sort lexicographically.

- An active season is never past.
- The game has an active season: past = inactive AND older-named than the active season. An inactive season NEWER than the active one is an upcoming (prep) season and stays editable, because staff create and prepare seasons in advance and managers affiliated with that name must be able to set up rosters.
- The game has no active season: past = inactive AND some season of the game has a newer name. The newest season is the current one and is not past (a between-seasons gap does not lock everyone out).
- Several active seasons (not expected; one per game) are treated by the newest active name.

Decision rationale: "active" alone cannot tell past from upcoming (both are inactive), so the name order is the tie-break; the alternative of using dates was rejected because season rows carry no reliable start/end dates.

## Enforcement (single mechanism, default-deny)

- `SeasonInfo.isPast` is computed where seasons are resolved (`getSeasonsForGame`, `getAuthorizedGameScopes`; `getActiveSeasonForGame` is never past).
- `assertSeasonNotPast(context, season)` throws `pastSeasonViewOnlyError(name)`: "2025-26 is a past season and is view-only." Staff admins are exempt.
- It is folded into the existing guards, so every mutation is covered by default and a new mutation using a guard is protected without remembering it:
  - `assertManagerForSchool(schoolId, gameId)` / `assertManagerForSchoolGame` refuse a past season unless the caller passes `{ allowPast: true }`. This covers `createPlayerInvite`, `createSchoolRoster`, and `reviewPlayerInvite` for BOTH approve and reject (it resolves the manager's season via `assertManagerForSchoolGame`). Reads (`resolveManagerScope`) pass `allowPast: true`.
  - `assertManagerForRoster(rosterId, { allowLocked?, allowPast? })` refuses a past season by default (delete, enroll, remove, role change, emergency swap, approve into an explicit roster). Only `getRosterEligibility` passes both opt-outs. Order of errors: Forbidden / different season, then view-only, then lock (a past season that is also locked reports view-only).
- Hexagonal path (kept consistent): `findRosterById` returns `isSeasonPast`, new optional `isSeasonPastByName(gameId, seasonName)`; `PortalService` refuses roster mutations on a past season and `createPlayerInvite` / `reviewPlayerInvite` (both decisions) / `revokePlayerInvite` for managers; super admins are exempt.
- Not touched: account-level actions (tour completion flag, sign-out). They do not go through these guards.

## Scopes and UI

`AuthorizedGameScope` carries `seasonIsPast`, `readOnly` (true for a past season) and `readOnlyReason` next to `rostersLocked`. The portal page derives `viewOnlyGameIds` / `viewOnlySeasonLabel` and passes them down; a view-only game shows only the view-only banner (not the lock banner as well).

- Header chip: a past season reads "Past season - View only"; an inactive season that is not past reads a neutral "Upcoming season". The old "Not the active season" chip is gone.
- `RostersSection`: banner "You are viewing 2025-26. This is a past season, so it is view only." (`role="status"`, same pattern as the lock banner); Create Roster disabled when every visible game is locked or view-only, otherwise the create modal lists only editable games; `RosterCard` gets `locked` for view-only games (Enroll, Emergency Sub, Delete, Remove, role select disabled; Check Eligibility enabled).
- `GenerateInviteCard`: disabled with an explanation when the selected game is view-only.
- `PendingApprovalsCard`: Approve and Reject both disabled with an explanation for view-only games (unlike the lock, where Reject stays enabled).
- UI disabling is a convenience; the server refuses regardless.

## Invariants

- Do not re-implement the past check per action; use the guards. Reads pass `allowPast: true` (and `allowLocked: true` for roster reads).
- School scoping, game coverage, roster -> team -> school tracing, ADMINISTRATOR-first ordering, the plain-`staff_members` rule and the roster lock are unchanged.
- A manager with several rows still resolves to the newest matching season (spec-026), so a manager who also holds a current-season row is not view-only.

## Open

- Invites have no season column (spec-019 gap): invite creation and review are gated by the manager's resolved season for the game, not by the invite's own season.
- If a manager's only season is past and staff never create a newer one, they stay view-only; staff must raise a new season/affiliation (by design).

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests: `app/lib/__tests__/season-past.test.ts` (pure `isPastSeason`: active exists, older inactive, newer inactive, no active with newer season, newest with no active, single season, order independence), `milestone3-portal-actions.test.ts` section 10 (every manager mutation refused on a past season with no write, reads and scopes allowed, `assertManager*` opt-outs, upcoming and active seasons editable, no-active-season case, newest-row-wins, staff admin allowed, another school / uncovered game still Forbidden, lock still works on an upcoming season; sections 8 and 9 updated so inactive-season editing uses an upcoming season), `portal-service-season.test.ts` and `portal-service-lock.test.ts` (hexagonal). Not verified: the portal in a browser.
