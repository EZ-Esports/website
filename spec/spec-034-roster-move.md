# spec-034: Move a player between sibling rosters

- **Spec ID:** spec-034
- **Title:** One tier per game: managers and staff move a player between a team's rosters; enrolling twice is refused
- **Status:** Implemented on branch `feat/roster-move` (not merged at the time of writing). No migration.
- **PR / Commit:** pending
- **Date:** 2026-10-26
- **Scope:** `movePlayerToRoster` (manager) and `moveRosterMember` (staff), the sibling-roster rule in manager enroll and staff add-player, a Move control in the portal roster builder and the staff roster view, and the `notifyRosterMembershipChanged` seam.

## Context & Motivation

The league rule: a student cannot be on both Varsity and JV of the same game. A team is one school, one game and one season; its rows in `rosters` (Varsity, JV, and any extra the school made) are **siblings**. Across different games a student can still be on a different tier. Until now nothing enforced this: enrolling a student on the second roster silently double-enrolled them, and fixing a wrong placement meant removing and re-enrolling (losing the in-game name and bio).

## Behavior

- **Move keeps the row.** The existing `players` row is updated in place (`roster_id`), so its id, in-game name and bio survive. A captain arrives as a regular player (`role = 'player'`, `is_captain = false`, together, because of `players_captain_role_check`; captaincy is per roster); the source roster is left without a captain and the portal notice says so. A sub stays a sub.
- **Refused:** a target roster on a different team (so never across games, seasons or schools), the same roster, a member already on the target roster, a player not on the source roster, and (managers only) a locked or inactive season or a roster the manager does not manage. Both rosters go through `assertManagerForRoster`, so authorization, season scope, lock and view-only checks are the existing ones. Staff (`moveRosterMember`, `MANAGE_ROSTERS`) resolve ids through the school (`roster-scope.ts`) and, like every action in that file, have no lock check.
- **Stale rows.** The UPDATE is `WHERE id = <player> AND roster_id = <source roster>` and uses `RETURNING`; zero rows means someone moved or removed the player since it was read, and the action answers "This player was just moved or removed by someone else. Refresh the page and try again." instead of overwriting.
- **Sibling rule on every add path:** manager `enrollPlayerToRoster`, the invite approval path in `reviewPlayerInvite`, and staff `createPlayer` (existing member) refuse a member already on a sibling roster: "X is already on Varsity. Use Move to put them on JV." A member already on *this* roster can still have their role or in-game name edited through enroll. The check is `siblingEnrollment` in `app/lib/db/roster-scope.ts`, run inside the write transaction.
- **Approving an invite** (`reviewPlayerInvite`) now accepts the invite and rosters the student in ONE transaction. A sibling conflict is detected before anything is written, so the invite stays pending and the manager sees the message. The default target roster (no explicit choice) is the team's oldest roster (`ORDER BY created_at, id`), no longer whichever row Postgres returned first.
- **Serialization.** Enroll, approve-enroll, move and the staff add/move take `pg_advisory_xact_lock(hashtext('roster-member:<teamId>:<memberId>'))` (`lockRosterMember`) as the first statement of their transaction, before the sibling check, so two concurrent requests cannot both pass it. Transaction-scoped, so it works through the Supabase transaction pooler.
- **No size cap.** Enrollment applies no roster size or eligibility limit (the 5-point gate is advisory, evaluated on demand), so a move applies none either.
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
