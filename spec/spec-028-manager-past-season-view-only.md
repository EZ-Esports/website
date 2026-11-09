# spec-028 — Inactive seasons are view-only for school managers

**Update (28 Oct 2026): the invite-season gap described below was closed by [spec-047](spec-047-invite-season-scope-and-enrollment-eligibility.md).** **Status:** Implemented on branch `feat/schools-roster-view`, PR #267. **Date:** 22 Oct 2026. **Scope:** `app/lib/season-name.ts` (error text), `app/lib/onboarding/manager-auth.ts`, `portal-actions.ts`, `app/(portal)/portal` (page, header chip, banner and disabled controls). No migration. **Builds on** [spec-026](spec-026-manager-season-by-name.md) (season by name) and [spec-020](spec-020-season-roster-lock.md) (lock). The file name keeps "past" so existing links work; the rule was simplified from "past vs upcoming" to "inactive" the same day, before merge.

## Why

spec-026 let a manager keep working in the season named by their affiliation even after staff activated a newer one. That kept their data visible, but also let them edit a finished season. A season that is not the game's active season is a read-only record for managers, whether it is older or newer than the active one.

## Rule

A manager sees ONLY the season of each game whose name equals their affiliation (spec-026). If that season is inactive (`seasons.is_active` false), older OR newer than the game's active season, or the game has no active season at all, the manager is strictly view-only. If it is the active season, behavior is unchanged (the roster lock still applies). No matching season: nothing is shown and writes are refused (unchanged). Staff admins and super admins are exempt.

There is no name comparison: the decision is `!season.isActive`. This retires the "free-text season name misclassification" concern of the earlier past/upcoming design (names are only used for the manager-to-season match of spec-026).

## Enforcement (single mechanism, default-deny)

- `SeasonInfo` carries `isActive`; `assertSeasonActive(context, season)` throws `inactiveSeasonViewOnlyError(name)`: "2025-26 is an inactive season and is view-only." Staff admins are exempt.
- It is folded into the existing guards, so every mutation is covered by default:
  - `assertManagerForSchool(schoolId, gameId)` / `assertManagerForSchoolGame` refuse an inactive season unless the caller passes `{ allowInactive: true }`. This covers `createPlayerInvite`, `createSchoolRoster`, and `reviewPlayerInvite` for BOTH approve and reject. Reads (`resolveManagerScope`) pass `allowInactive: true`.
  - `assertManagerForRoster(rosterId, { allowLocked?, allowInactive? })` refuses an inactive season by default (delete, enroll, remove, role change, emergency swap, approve into an explicit roster). Only `getRosterEligibility` passes both opt-outs. Order of errors: Forbidden / different season, then view-only, then lock (an inactive season that is also locked reports view-only).
- Hexagonal path: deleted (see "Removal of the hexagonal PortalService" below). It had been required to implement `isSeasonInactiveByName` so an adapter could not silently allow writes; with no `PortalService` there is no such adapter contract left.
- Not touched: account-level actions (tour completion flag, sign-out).

## Single-season visibility (audit)

Every portal read is limited to the manager's resolved season: `getSchoolRosters` and `getSchoolPlayerPool` (enrollments) filter by the scopes' season ids; `getRosterEligibility` and every roster mutation require `team.seasonId` to be the resolved season ("different season" otherwise). Known remaining leak (needs a schema decision, see open-threads): `player_invites` has no season column, so `getSchoolInvites` / `getPendingSubmissions` show invites of the managed GAME regardless of season.

## Scopes and UI

`AuthorizedGameScope` carries `seasonIsActive`, `readOnly` (true when inactive) and `readOnlyReason` next to `rostersLocked`. The portal page derives `hasInactiveSeason` / `viewOnlyGameIds` / `viewOnlySeasonLabel`; a view-only game shows only the view-only banner (not the lock banner as well).

- Header chip: "Inactive season - View only" (the earlier "Past season" / "Upcoming season" chips are gone).
- `RostersSection`: banner "You are viewing 2025-26. This season is inactive, so it is view only." (`role="status"`); Create Roster disabled when every visible game is locked or view-only; `RosterCard` gets `locked` for view-only games (Enroll, Emergency Sub, Delete, Remove, role select disabled; Check Eligibility enabled).
- `GenerateInviteCard`: disabled with an explanation when the selected game is view-only.
- `PendingApprovalsCard`: Approve and Reject both disabled with an explanation for view-only games (unlike the lock, where Reject stays enabled).
- UI disabling is a convenience; the server refuses regardless.

## Invariants

- Do not re-implement the inactive check per action; use the guards. Reads pass `allowInactive: true` (and `allowLocked: true` for roster reads).
- School scoping, game coverage, roster -> team -> school tracing, ADMINISTRATOR-first ordering, the plain-`staff_members` rule and the roster lock are unchanged.
- A manager with several rows still resolves to the newest matching season (spec-026), so a manager who also holds an active-season row is not view-only.

## Open

- Invites have no season column (spec-019 gap): invite creation and review are gated by the manager's resolved season for the game, not by the invite's own season, and other-season invites remain visible.
- A manager whose only season is inactive stays view-only until staff activate it or raise a new affiliation (by design); staff prepare seasons through the admin tools, not the portal.

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests: `app/lib/__tests__/season-inactive.test.ts` (error text), `milestone3-portal-actions.test.ts` section 10 (every manager mutation refused on an older inactive AND a newer inactive season with no write, reads and scopes allowed, `assertManager*` opt-outs, active season editable, no-active-season case (all view-only), newest-row-wins, staff admin allowed, another school / uncovered game still Forbidden, lock still works on the active season and view-only wins over it on an inactive one; sections 7-9 updated). Not verified: the portal in a browser.

## Removal of the hexagonal PortalService (22 Oct 2026)

`app/lib/onboarding/core/services/portal-service.ts` (`PortalService`, the `SchoolManagerPortalUseCase` interface and the `SchoolManagerPortalPort` alias) had no production importer: the live portal runs through `portal-actions.ts` / `manager-auth.ts`, and only two test files constructed `PortalService`. It was a parallel copy of the season, lock and view-only rules that could drift (it silently allowed writes if an adapter omitted a check), so it was deleted together with everything used only by it:

- `portal-service-season.test.ts`, `portal-service-lock.test.ts`.
- Repository port methods `findSchoolRosters`, `findSchoolPlayerPool`, `findRosterById`, `isSeasonLockedByName`, `isSeasonInactiveByName`, `findInviteById`, `createPlayerInvite`, `listSchoolInvites`, `listPendingSubmissions`, `revokePlayerInvite`, `approveInviteAndEnroll`, `enrollPlayerToRoster`, `updateRosterPlayerRole`, `removePlayerFromRoster`, `emergencySwapSub`, their `DrizzleOnboardingRepository` implementations, and the DAL functions behind them in `app/lib/db/onboarding-repository.ts` (`findRosterWithTeam`, `getSeasonRosterState`, `isSeasonInactiveByName`, `isSeasonRostersLockedByName`, `loadSchoolRosterData`, `loadSchoolPlayerPoolData`, `findPlayerInviteById`, `insertPlayerInvite`, `listPendingPlayerInvites`, `listSubmittedPlayerInvites`, `markPlayerInviteRevoked`, `approveInviteAndEnrollTx`, `enrollPlayerToRosterTx`, `updateRosterPlayerRoleTx`, `deletePlayerFromRoster`, `swapStarterAndSubTx`).
- Domain types `SchoolPlayerPoolItem`, `RosterPlayerItem`, `SchoolRosterWithPlayers`, the domain `SchoolManagerContext` (the live one is in `manager-auth.ts`), and `assertManagerTenancy` / `normalizeCompetitiveRole` in `core/domain/invariants.ts`.

Kept because live code still uses them: `DrizzleOnboardingRepository` and the port subset used by `StaffManagerService` (`manager-actions.ts`) and `CandidateService` (school/game lookups, `findInviteByTokenHash`, `updateInviteDraft`, `submitInvite`, manager provisioning, manager invites, audit log), `CompetitiveRole` / `PlayerSubmissionDraft`, `hashToken`, `generateCryptoToken`, `assertValidInviteForSubmission`, and `ROSTERS_LOCKED_ERROR` in `manager-auth.ts`. No test coverage was lost: every behavior `PortalService` tested (lock refusal on every mutation and approval, reject allowed while locked, view-only on inactive seasons for rosters and invites, view-only wins over lock, different-season refusal, season-scoped pool, super admin exempt) is covered against the live guards in `milestone3-portal-actions.test.ts` sections 8 to 10. The `revokePlayerInvite` method had no live counterpart (the portal has no revoke action).
