# spec-020 — Season roster lock

**Status:** In Review (branch `feat/season-roster-lock`, stacked on `fix/manager-portal-season-scope` / spec-019, PR TBD). **Date:** 18 Oct 2026. **Scope:** `seasons.rosters_locked_at` (migration `0050`), `app/lib/onboarding/manager-auth.ts`, `portal-actions.ts`, hexagonal `PortalService` / repository, League Setup, manager portal roster UI.

**Migration `0050_season_rosters_locked` is NOT applied to production.** It was applied only to a local throwaway Postgres (`ezesports_test`, loopback). The code must not deploy before 0050 is applied: any `db.select().from(schema.seasons)` (for example `app/lib/db/league.ts`) now selects the new column, so the public site and the staff admin break, not just the portal. Run `db:migrate` against production (with the usual user confirmation) first, then deploy.

**Collision risk:** open PR #252 (spec-018, manager invites) uses migration `0049`. This branch uses file `0050` and journal `idx` 50 / `when` 1790882000005 (after `0049`'s expected `...004`), so the journal edits are additive and should merge with a trivial conflict at the end of `entries`. Merge PR #252 (0049) first, or bump 0050's `when`: drizzle applies by `when`, so if 0050 reaches production first, 0049 (older `when`) could be silently skipped. Whichever PR merges second must re-check that `idx` values stay unique and `when` stays increasing (`season-rosters-locked-migration.test.ts` asserts both). Hand-written like 0047/0048 (snapshots stop at 0042).

## Why

Staff need to freeze a game's rosters mid-season (for example once the bracket or schedule is built) so school managers cannot add, remove or swap players underneath it.

## Design

- **Data:** nullable `seasons.rosters_locked_at timestamp`; null = unlocked. Per season row. Because a game has exactly one active season (spec-019), locking that season locks the game's current rosters for managers; other games are untouched.
- **Guard:** `assertSeasonRostersUnlocked(context, season)` in `manager-auth.ts` throws `ROSTERS_LOCKED_ERROR` ("Rosters for this season are locked by EZ Esports staff. Contact an admin to request changes.") for non-staff-admins when `rostersLockedAt` is set. `getActiveSeasonForGame` now returns `rostersLockedAt`. `getAuthorizedGameScopes` returns `rostersLocked` per game scope for the UI.
- **Default-deny on rosters:** `assertManagerForRoster(rosterId, { allowLocked? })` is the mutation guard and refuses a locked season unless the caller passes `allowLocked: true`. Only `getRosterEligibility` (a read) passes it. A new mutation that calls the guard is therefore protected without remembering the lock.
- **Create path:** `createSchoolRoster` calls the guard after resolving the game's active season.
- **Staff admins (ADMINISTRATOR) are exempt** and can still edit locked rosters. School managers who are not staff admins are not.

### Enforcement per action (manager, season locked)

| Action | Result |
| --- | --- |
| `createSchoolRoster` | refused |
| `deleteSchoolRoster` | refused |
| `enrollPlayerToRoster` | refused |
| `removePlayerFromRoster` | refused |
| `updateRosterPlayerRole` | refused |
| `emergencySwapSub` | refused (decided: no emergency exception) |
| `reviewPlayerInvite` approve (explicit `rosterId` or default roster) | refused before the invite changes state |
| `reviewPlayerInvite` reject | allowed |
| `getSchoolRosters`, `getRosterEligibility`, `getSchoolPlayerPool`, invites reads | allowed |

**Invite approval decision:** approval is the intake onto a roster, so for a manager it is refused outright while the game's active season is locked (when the invite has a member and a game), rather than accepting the invite and skipping enrollment, which would leave an accepted-but-unrostered student with no obvious next step. The invite stays `submitted`, so the manager can approve after the unlock; rejecting still works. Staff admins can approve while locked. Trade-off: an approval that would have enrolled nobody (no team yet) is also refused during a lock; accepted as the simpler, safer rule.

- **Best-effort at request start:** the lock is read when the guard runs, not held for the whole mutation. A request that passed the check just before staff locked can still commit. Closing that window needs a `FOR SHARE` read of the season row inside the mutation's transaction; not done.
- **Lifecycle:** a new active season starts unlocked (null column), and the previous season's lock goes dormant with it (managers never act on an inactive season). Locking an inactive season has no manager effect until it is activated; the confirm dialog says so. Locking is idempotent: a repeat lock keeps the first timestamp.
- **Hexagonal path (unused by the app, kept consistent):** `findRosterById` returns `isSeasonLocked`, the new optional `isActiveSeasonLocked(gameId)` repository method backs the default-roster approval check, and `PortalService` refuses non-super-admin enroll / remove / role / swap / approve while locked.

### Staff UI (Admin -> League Setup)

Each season row shows a "Rosters locked" warning chip when locked, and a chip-style toggle button ("Lock rosters" / "Unlock rosters") with a confirm dialog. Server actions `lockSeasonRosters(seasonId)` / `unlockSeasonRosters(seasonId)` in `app/(admin)/admin/league/actions.ts` require `Permissions.MANAGE_LEAGUE`, set or clear the timestamp, call `revalidateLeague()` (`updateTag('seasons')`, `'teams'`, admin paths) plus `revalidatePath('/portal')`, and return `{ success, error? }`. `updateSeason` does not touch the column, so editing a season never changes its lock.

### Manager UI

`/portal` computes `lockedGameIds` / `lockedSeasonLabel` from the scopes (always empty for staff admins) and passes them down. `RostersSection` shows an amber "Rosters locked for 2026-27" status banner explaining the restriction and disables Create Roster when every game is locked (otherwise the create modal lists only unlocked games); `RosterCard` disables Enroll, Emergency Sub, Delete, per-player Remove and the role select; `PendingApprovalsCard` disables "Approve & Enroll" for locked games with an explanation. Reject and Check Eligibility stay enabled. The UI is a convenience; the server refuses regardless.

### Caching

The portal reads seasons and rosters straight from the database on each request (no `unstable_cache`), so a staff toggle takes effect on the manager's next request. The lock actions still call `updateTag('seasons')` so cached admin/public season reads refresh, per CLAUDE.md. A manager with a page already open sees stale controls until reload, but every mutation is re-checked on the server and returns the locked error.

## Invariants

- The lock is checked in `manager-auth.ts` only (plus the invite-approval default-roster branch and the hexagonal service). Do not re-implement it per action.
- Reads must never call the lock check; pass `allowLocked: true` when a read needs `assertManagerForRoster`.
- Staff admin bypass is the ADMINISTRATOR permission, as in spec-019.

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests: `milestone3-portal-actions.test.ts` section 9 (every manager mutation refused while locked with no write and allowed while unlocked, unlock restores access, staff admin allowed while locked, per-game isolation, reads and scopes while locked, invite approval refused / reject allowed / admin allowed), `portal-service-lock.test.ts` (hexagonal), `league/__tests__/season-lock-actions.test.ts` (MANAGE_LEAGUE required, set/clear, tags, result shape), `db/__tests__/season-rosters-locked-migration.test.ts`, and the opt-in `season-lock-local-db.test.ts` (`LOCAL_SEASON_DB_TEST=1` with a loopback `DATABASE_URL`; run once against `ezesports_test` after applying 0050). Not verified: the UI in a browser; `npm run build`.

## Open

- Lock is per season, not per roster or school; there is no scheduled auto-lock.
- Nothing records who locked or when beyond the timestamp (no actor column).
