# spec-034: Move a player between sibling rosters, and roster size limits

- **Spec ID:** spec-034
- **Title:** One tier per game: managers and staff move a player between a team's rosters; enrolling twice is refused; a roster holds at most 7 players and 2 subs
- **Status:** Implemented on branch `feat/roster-move` (not merged at the time of writing). No migration.
- **PR / Commit:** pending
- **Date:** 2026-10-26
- **Scope:** `movePlayerToRoster` (manager) and `moveRosterMember` (staff), the sibling-roster rule in manager enroll and staff add-player, a Move control in the portal roster builder and the staff roster view, and the `notifyRosterMembershipChanged` seam.

## Context & Motivation

The league rule: a student cannot be on both Varsity and JV of the same game. A team is one school, one game and one season; its rows in `rosters` (Varsity, JV, and any extra the school made) are **siblings**. Across different games a student can still be on a different tier. Until now nothing enforced this: enrolling a student on the second roster silently double-enrolled them, and fixing a wrong placement meant removing and re-enrolling (losing the in-game name and bio).

## Roster size limits (7 players, 2 subs)

Owner's rule: a roster holds at most `MAX_ROSTER_PLAYERS = 7` players and at most `MAX_ROSTER_SUBS = 2` of them substitutes; at 7 players, adding to the roster is locked. Both constants live in `app/lib/onboarding/roster-limits.ts` (pure, shared by the server actions and the UIs; the pure helpers `rosterCapacityError`, `occupancyOf`, `moveBlockedReason` live there too). Every row in `players` counts toward the 7, whatever its role (player, captain, sub, coach), which matches the count the roster cards show.

| Path | Player cap (7) | Sub cap (2) |
| --- | --- | --- |
| Manager `enrollPlayerToRoster`, invite approval (`reviewPlayerInvite`), staff `createPlayer` (existing or new member) | Refused when the roster already has 7 | Refused when the role is sub and 2 other subs exist |
| Manager `movePlayerToRoster`, staff `moveRosterMember` | Refused when the TARGET has 7 (moving out of a full roster is fine) | Refused when the mover is a sub and the target has 2 subs |
| Manager `updateRosterPlayerRole`, staff `updatePlayer` | Not applied (nobody joins) | Refused when changing to sub and 2 OTHER subs exist; a sub may stay a sub |
| `emergencySwapSub` | Not applied | Not applied: it swaps a starter and a sub, so both counts are unchanged (a test documents this) |

- Messages: "Varsity is full (7 of 7 players)." and "Varsity already has 2 substitutes." Returned as `{ success: false, error }` like the other roster rejections; staff actions add "Nothing was saved." on add/edit.
- **Race-safe counting.** Each transaction that counts takes `pg_advisory_xact_lock` on the roster (`lockRoster`, key `roster:<rosterId>`) and counts inside the transaction. Locks are always acquired member-then-roster (`lockRosterMember`, then `lockRoster`), and a transaction takes the roster lock of only one roster (a move locks the target), so lock order is consistent and cannot deadlock. Tests assert the lock is taken before the count.
- **Eligibility stays minimum-only.** `getRosterEligibility` (>= 6 players, >= 5 starters, >= 1 sub, exactly 1 captain, Riot, Discord, in guild) has no maximum and must not import these constants. A test proves a 7-player/2-sub roster is eligible, that even an over-cap roster gets no max-based reason, and that the function body does not reference the limits.
- **App-level only.** There is no database constraint, so seed scripts and hand-run SQL bypass the caps. Rosters that already exceed them are left alone and are not auto-fixed (they cannot be added to, and can still be edited, moved out of or emptied).
- **Staff are held to the caps** by default because they are league rules. An override for staff was not built (see the report on this change): it would need an explicit, audited action rather than a silent bypass.
- **UI.** Roster cards show `N/7 players` (and `(n/2 subs)`); at 7 the Enroll / Add player control is disabled and reads "Roster full (7/7)"; the Move control does not offer a full target (the button stays, disabled, reading e.g. "JV is full (7/7)"; in the menu the item is disabled) and does not offer a roster with 2 subs to a sub ("JV has 2 subs"); the Sub option of the role select is disabled when 2 other subs exist. The live region for outcomes is unchanged.
- **Captain behaviour is unchanged by this change**: one captain per roster, enforced by the database (see below), nothing across Varsity and JV.

### How captain uniqueness works today

- Database: the partial unique index `players_roster_one_captain_idx` on `(roster_id) WHERE is_captain = true` allows one captain per roster, and the check `players_captain_role_check` ties `role = 'captain'` to `is_captain = true` (both or neither).
- Manager actions that promote a captain (`enrollPlayerToRoster`, `updateRosterPlayerRole`, the approve path of `reviewPlayerInvite`) first demote the roster's current captain to a regular `player` (`role = 'player'`, `is_captain = false`; never to sub), in the same transaction, then write the new captain.
- Staff `createPlayer` / `updatePlayer` do not demote: a second captain violates the index and the staff gets "This roster already has a captain. Demote the current captain before assigning a new one."
- A moved captain arrives on the new roster as a regular player; `emergencySwapSub` hands the captaincy to the sub who comes in.
- Nothing links the captain of Varsity to the captain of JV: each roster can have its own.

## Behavior

- **Move keeps the row.** The existing `players` row is updated in place (`roster_id`), so its id, in-game name and bio survive. A captain arrives as a regular player (`role = 'player'`, `is_captain = false`, together, because of `players_captain_role_check`; captaincy is per roster); the source roster is left without a captain and the portal notice says so. A sub stays a sub.
- **Refused:** a target roster on a different team (so never across games, seasons or schools), the same roster, a member already on the target roster, a player not on the source roster, and (managers only) a locked or inactive season or a roster the manager does not manage. Both rosters go through `assertManagerForRoster`, so authorization, season scope, lock and view-only checks are the existing ones. Staff (`moveRosterMember`, `MANAGE_ROSTERS`) resolve ids through the school (`roster-scope.ts`) and, like every action in that file, have no lock check.
- **Stale rows.** The UPDATE is `WHERE id = <player> AND roster_id = <source roster>` and uses `RETURNING`; zero rows means someone moved or removed the player since it was read, and the action answers "This player was just moved or removed by someone else. Refresh the page and try again." instead of overwriting.
- **Sibling rule on every add path:** manager `enrollPlayerToRoster`, the invite approval path in `reviewPlayerInvite`, and staff `createPlayer` (existing member) refuse a member already on a sibling roster: "X is already on Varsity. Use Move to put them on JV." A member already on *this* roster can still have their role or in-game name edited through enroll. The check is `siblingEnrollment` in `app/lib/db/roster-scope.ts`, run inside the write transaction.
- **Approving an invite** (`reviewPlayerInvite`) now accepts the invite and rosters the student in ONE transaction. A sibling conflict is detected before anything is written, so the invite stays pending and the manager sees the message. The default target roster (no explicit choice) is the team's oldest roster (`ORDER BY created_at, id`), no longer whichever row Postgres returned first.
- **Serialization.** Enroll, approve-enroll, move and the staff add/move take `pg_advisory_xact_lock(hashtext('roster-member:<teamId>:<memberId>'))` (`lockRosterMember`) as the first statement of their transaction, before the sibling check, so two concurrent requests cannot both pass it. Transaction-scoped, so it works through the Supabase transaction pooler.
- **Size limits apply to moves**: see "Roster size limits" above. Eligibility (the 5-point gate) is advisory and evaluated on demand, and it stays minimum-only.
- **Errors are returned, not thrown.** Next.js omits the message of an error thrown from a server action in production, so a thrown rejection reaches the manager as a generic failure (confirmed). The expected rejections of `movePlayerToRoster`, `enrollPlayerToRoster` and the approve path of `reviewPlayerInvite` are therefore returned as `{ success: false, error }` (type `RosterActionRejection`) and the portal shows `result.error`: in the Enroll modal, the approvals notice, and the roster notice. Still thrown (unexpected, or states the UI already disables): missing parameters, authorization, season lock, view-only season, wrong school or season, `Member does not belong to the school`, and the neighbouring actions `removePlayerFromRoster`, `updateRosterPlayerRole`, `emergencySwapSub`, `deleteSchoolRoster`, `createSchoolRoster`, whose behaviour is unchanged. Staff actions already returned results.
- **Cache.** Manager actions call `updateCacheTags(ROSTERS, PLAYERS, TEAMS)` like enroll and remove; staff call `updateTag('players')` and `updateTag('rosters')` like `deleteRosterMember`. No new tags.

## UI

- Portal roster card: each player row has "Move to JV" / "Move to Varsity" (label from the sibling roster's name). The accessible name starts with the visible text and then says whose row it is: "Move to JV: Ana Lee (currently Varsity)" (label in name). When the team has more than two rosters it is a React Aria `MenuTrigger` + `Menu` ("Move to...", one item per roster). Disabled while the season is locked or view-only and while that player's move is in flight. On success the row moves between cards in local state and the player pool entry follows, the same optimistic style as enroll and remove. The outcome (success or rejection) appears in a `role="status"` `aria-live="polite"` region at the top of the rosters section.
- Staff roster view: the same button or menu beside Edit and Remove on every player row; the result is the existing toast (`role="status"` / `role="alert"`).

## Seam: `notifyRosterMembershipChanged`

`app/lib/onboarding/roster-membership-events.ts` exports `notifyRosterMembershipChanged(memberIds)`, a documented **no-op** reserved for the Discord role feature. Rule: it is called only **after** the transaction commits, never inside one, and a failing consumer must never fail the action (the function swallows and logs the message only; callers guard it again).

Callers (manager): `enrollPlayerToRoster`, `removePlayerFromRoster`, `movePlayerToRoster` (one member), `emergencySwapSub` (both), `updateRosterPlayerRole`, and the approve path of `reviewPlayerInvite` (only when a student was rostered). Callers (staff, `rosters/actions.ts`): `createPlayer`, `updatePlayer` (role changes), `deleteRosterMember`, `moveRosterMember`, `deleteRoster` (every member the cascade removed).

**Paths that do NOT call it**, so a consumer must not assume it sees every change:

- Deleting a **game** or a **season** (`deleteGame`, `deleteSeason` in `app/lib/db/league.ts`): the database cascade removes teams, rosters and players without the application reading who was on them. Deleting a season is rare and staff-only; a consumer should reconcile after one.
- `db/seed-gold.ts` and the ingestion scripts: they insert `players` rows directly and are run by hand against a chosen database.
- Manager `deleteSchoolRoster`: it only deletes empty rosters, so no member is affected.
- Staff edits to a member that do not touch rosters (name, Discord handle, class year) and member records created or removed elsewhere.

A consumer should treat the call as a hint to re-derive a member's state from the database, and run a periodic full reconcile.

## Known limits

- The one-tier rule is enforced in application code (advisory lock plus a check). There is no database constraint (it would need a team id on `players`), and rows that already violate the rule from before this change are untouched; they can still be edited on the roster they are on. Writers outside these actions (seed scripts, hand-run SQL) bypass the lock.
- Manager authorization and lock failures from `assertManagerForRoster` still throw, so if staff lock the season while a manager has the page open the manager sees a generic message. The controls are disabled for a locked season on page load.

## Verification

`app/lib/onboarding/__tests__/milestone3-portal-actions.test.ts` (section 11), `app/(admin)/admin/schools/__tests__/roster-edit-actions.test.ts`, `app/lib/db/__tests__/roster-scope.test.ts` (the query filters and the lock key), `app/(portal)/portal/components/__tests__/roster-card-move.test.tsx` and `app/components/admin/__tests__/player-row-move.test.tsx`. Each guard was removed in turn (mutation check) and the suite failed.
