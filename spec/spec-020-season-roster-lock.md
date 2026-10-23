# spec-020 — Season roster lock

**Status:** Shipped (PR #256, squash `125db67`, merged 18 Oct 2026; spec-019 / #255 and spec-018 / #252 merged earlier). Migration `0050` was applied to production on 18 Oct 2026. **Date:** 18 Oct 2026. **Note:** [spec-028](spec-028-manager-past-season-view-only.md) adds a separate view-only rule for inactive seasons, folded into the same guards (`allowInactive` beside `allowLocked`); on an inactive season the view-only error is reported before the lock error. **Scope:** `seasons.rosters_locked_at` (migration `0050`), `app/lib/onboarding/manager-auth.ts`, `portal-actions.ts`, League Setup, manager portal roster UI.

**Migration `0050_season_rosters_locked` was applied to production on 18 Oct 2026**, after a full backup and before PR #256 merged (the code must not deploy before 0050: any `db.select().from(schema.seasons)`, for example `app/lib/db/league.ts`, selects the new column, so the public site and the staff admin would break, not just the portal). Verified afterwards with read-only queries: the column exists (nullable, no default), all 15 seasons are intact and none are locked.

**Ordering with 0049:** PR #252 (spec-018, manager invites, migration `0049`) has merged and `0049` is already applied to production, so `0050` (journal `idx` 50, `when` 1790882000005, after `0049`'s `...004`) is strictly the next migration and no skipping risk remains. `season-rosters-locked-migration.test.ts` still asserts `idx` uniqueness and `when` ordering. Hand-written like 0047/0048 (snapshots stop at 0042). PR #255 (spec-019, active-season scoping) has also merged to `main` (squash `b85e6fa`); this branch was merged with `origin/main` after both landed.

## Why

Staff need to freeze a game's rosters mid-season (for example once the bracket or schedule is built) so school managers cannot add, remove or swap players underneath it.

## Design

- **Data:** nullable `seasons.rosters_locked_at timestamp`; null = unlocked. Per season row. A manager's season is the one named by their affiliation, active or not ([spec-026](spec-026-manager-season-by-name.md)), so locking a season locks it for the managers who work in it; other seasons and games are untouched.
- **Guard:** `assertSeasonRostersUnlocked(context, season)` in `manager-auth.ts` throws `ROSTERS_LOCKED_ERROR` ("Rosters for this season are locked by EZ Esports staff. Contact an admin to request changes.") for non-staff-admins when `rostersLockedAt` is set. `getActiveSeasonForGame` now returns `rostersLockedAt`. `getAuthorizedGameScopes` returns `rostersLocked` per game scope for the UI.
- **Default-deny on rosters:** `assertManagerForRoster(rosterId, { allowLocked? })` is the mutation guard and refuses a locked season unless the caller passes `allowLocked: true`. Only `getRosterEligibility` (a read) passes it. A new mutation that calls the guard is therefore protected without remembering the lock.
- **Create path:** `createSchoolRoster` calls the guard after resolving the manager's season for the game (spec-026).
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

**Invite approval decision:** approval is the intake onto a roster, so for a manager it is refused outright while the manager's season for the game is locked (when the invite has a member and a game), rather than accepting the invite and skipping enrollment, which would leave an accepted-but-unrostered student with no obvious next step. The invite stays `submitted`, so the manager can approve after the unlock; rejecting still works. Staff admins can approve while locked. Trade-off: an approval that would have enrolled nobody (no team yet) is also refused during a lock; accepted as the simpler, safer rule.

- **Best-effort at request start:** the lock is read when the guard runs, not held for the whole mutation. A request that passed the check just before staff locked can still commit. Closing that window needs a `FOR SHARE` read of the season row inside the mutation's transaction; not done.
- **Lifecycle:** a new season starts unlocked (null column). Superseded by [spec-026](spec-026-manager-season-by-name.md): the lock is no longer dormant when a season is inactive; it applies to the manager's resolved season (by name), active or not. Locking is idempotent: a repeat lock keeps the first timestamp.
- **Hexagonal path:** removed. The unused `PortalService` and the repository methods that mirrored the lock were deleted on 22 Oct 2026 (see [spec-028](spec-028-manager-past-season-view-only.md)); the lock lives in `manager-auth.ts` only.

### Staff UI (Admin -> League Setup)

Each season row shows a "Rosters locked" warning chip when locked, and a chip-style toggle button ("Lock rosters" / "Unlock rosters") with a confirm dialog. Server actions `lockSeasonRosters(seasonId)` / `unlockSeasonRosters(seasonId)` in `app/(admin)/admin/league/actions.ts` require `Permissions.MANAGE_LEAGUE`, set or clear the timestamp, call `revalidateLeague()` (`updateTag('seasons')`, `'teams'`, admin paths) plus `revalidatePath('/portal')`, and return `{ success, error? }`. `updateSeason` does not touch the column, so editing a season never changes its lock.

### Manager UI

`/portal` computes `lockedGameIds` / `lockedSeasonLabel` from the scopes (always empty for staff admins) and passes them down. `RostersSection` shows an amber "Rosters locked for 2026-27" status banner explaining the restriction and disables Create Roster when every game is locked (otherwise the create modal lists only unlocked games); `RosterCard` disables Enroll, Emergency Sub, Delete, per-player Remove and the role select; `PendingApprovalsCard` disables "Approve & Enroll" for locked games with an explanation. Reject and Check Eligibility stay enabled. The UI is a convenience; the server refuses regardless.

### Caching

The portal reads seasons and rosters straight from the database on each request (no `unstable_cache`), so a staff toggle takes effect on the manager's next request. The lock actions still call `updateTag('seasons')` so cached admin/public season reads refresh, per CLAUDE.md. A manager with a page already open sees stale controls until reload, but every mutation is re-checked on the server and returns the locked error.

## Invariants

- The lock is checked in `manager-auth.ts` only (plus the invite-approval default-roster branch). Do not re-implement it per action.
- Reads must never call the lock check; pass `allowLocked: true` when a read needs `assertManagerForRoster`.
- Staff admin bypass is the ADMINISTRATOR permission, as in spec-019.

## Verification

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Tests: `milestone3-portal-actions.test.ts` section 9 (every manager mutation refused while locked with no write and allowed while unlocked, unlock restores access, staff admin allowed while locked, per-game isolation, reads and scopes while locked, invite approval refused / reject allowed / admin allowed), `league/__tests__/season-lock-actions.test.ts` (MANAGE_LEAGUE required, set/clear, tags, result shape), `db/__tests__/season-rosters-locked-migration.test.ts`, and the opt-in `season-lock-local-db.test.ts` (`LOCAL_SEASON_DB_TEST=1` with a loopback `DATABASE_URL`; run once against `ezesports_test` after applying 0050). Not verified: the UI in a browser; `npm run build`.

## Open

- Lock is per season, not per roster or school; there is no scheduled auto-lock.
- Nothing records who locked or when beyond the timestamp (no actor column).
