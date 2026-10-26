# spec-033: Move a player between sibling rosters

- **Spec ID:** spec-033
- **Title:** One tier per game: managers and staff move a player between a team's rosters; enrolling twice is refused
- **Status:** Implemented on branch `feat/roster-move` (not merged at the time of writing). No migration.
- **PR / Commit:** pending
- **Date:** 2026-10-26
- **Scope:** `movePlayerToRoster` (manager) and `moveRosterMember` (staff), the sibling-roster rule in manager enroll and staff add-player, a Move control in the portal roster builder and the staff roster view, and the `notifyRosterMembershipChanged` seam.

## Context & Motivation

The league rule: a student cannot be on both Varsity and JV of the same game. A team is one school, one game and one season; its rows in `rosters` (Varsity, JV, and any extra the school made) are **siblings**. Across different games a student can still be on a different tier. Until now nothing enforced this: enrolling a student on the second roster silently double-enrolled them, and fixing a wrong placement meant removing and re-enrolling (losing the in-game name and bio).

## Behavior

- **Move keeps the row.** The existing `players` row is updated in place (`roster_id`), so its id, in-game name and bio survive. A captain arrives as a regular player (`role = 'player'`, `is_captain = false`, together, because of `players_captain_role_check`; captaincy is per roster); the source roster is left without a captain and the portal toast says so. A sub stays a sub.
- **Refused:** a target roster on a different team (so never across games, seasons or schools), the same roster, a member already on the target roster, a player not on the source roster, and (managers only) a locked or inactive season or a roster the manager does not manage. Both rosters go through `assertManagerForRoster`, so authorization, season scope, lock and view-only checks are the existing ones. Staff (`moveRosterMember`, `MANAGE_ROSTERS`) resolve ids through the school (`roster-scope.ts`) and, like every action in that file, have no lock check.
- **Sibling rule on add:** `enrollPlayerToRoster` and the staff `createPlayer` (existing member) refuse a member already on a sibling roster: "X is already on Varsity. Use Move to put them on JV." A member already on *this* roster can still have their role or in-game name edited through enroll. The check is `siblingEnrollment` in `app/lib/db/roster-scope.ts`, run inside the write transaction.
- **No size cap.** Enrollment applies no roster size or eligibility limit (the 5-point gate is advisory, evaluated on demand), so a move applies none either.
- **Errors.** The manager actions throw `Error` with the user-facing message, like their neighbours; the portal client shows it with `alert`. The staff action returns `{ success: false, error }` like the other staff actions and the page toasts it.
- **Cache.** Manager actions call `updateCacheTags(ROSTERS, PLAYERS, TEAMS)` like enroll and remove; staff call `updateTag('players')` and `updateTag('rosters')` like `deleteRosterMember`. No new tags.

## UI

- Portal roster card: each player row has "Move to JV" / "Move to Varsity" (label from the sibling roster's name, accessible name "Move Ana Lee from Varsity to JV"). When the team has more than two rosters it is a labelled native `<select>` ("Move to..."). Disabled while the season is locked or view-only and while that player's move is in flight. On success the row moves between cards in local state and the player pool entry follows, the same optimistic style as enroll and remove.
- Staff roster view: a "Move to JV" ghost button (or the same select) beside Edit and Remove on every player row.

## Seam: `notifyRosterMembershipChanged`

`app/lib/onboarding/roster-membership-events.ts` exports `notifyRosterMembershipChanged(memberIds)`, a documented **no-op** reserved for the Discord role feature. Rule: it is called only **after** the transaction commits, never inside one, and a failing consumer must never fail the action (the function swallows and logs the message only; callers guard it again). Callers: manager enroll, remove, move (one member), emergency swap (both), staff add-player, remove-player, move, and delete-roster (every member the cascade removed). `deleteSchoolRoster` (manager) only deletes empty rosters, so it has no affected members and does not call it.

## Known limits

- The one-tier rule is enforced in application code only. There is no database constraint (it would need a team id on `players`), so two simultaneous enrolls could still double-enroll a member, and rows that already violate the rule from before this change are untouched (they can still be edited on the roster they are on).
- Manager errors are thrown; if Next.js masks thrown server-action messages in production the manager sees a generic message for every rejection, as already happens for the lock and view-only errors. Not verified against production.

## Verification

`app/lib/onboarding/__tests__/milestone3-portal-actions.test.ts` (section 11), `app/(admin)/admin/schools/__tests__/roster-edit-actions.test.ts`, and `app/(portal)/portal/components/__tests__/roster-card-move.test.tsx`. Each guard was removed in turn (mutation check) and the suite failed.
