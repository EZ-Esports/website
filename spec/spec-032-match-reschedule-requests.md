# spec-032: Match Reschedule Requests

- **Spec ID:** spec-032
- **Title:** Managers request a reschedule in the portal; the opponent agrees; staff approve
- **Status:** In Progress (code, tests, lint and build pass; migration 0053 NOT applied to production; not run end to end with real data, see Verification)
- **PR / Commit:** branch `feat/reschedule-requests`, PR TBD
- **Date:** 2026-10-25
- **Scope:** two new tables (migration `0053`), manager server actions, staff server actions, a request column in the portal Matches section, a staff queue on `/admin/matches`. Part 2 of [#274](https://github.com/EZ-Esports/website/issues/274); part 1 is [spec-031](spec-031-manager-matches-view.md).

## Context & Motivation

Rules page 4.3 sets the league's rescheduling rules (72 hours, two proposed times, no reverting once agreed). Until now a reschedule was agreed outside the site and staff edited the match. Managers must never move a match themselves: a request only proposes, and the match keeps its time until staff approve.

## Flow and statuses

`pending_opponent` (requester proposed 2-5 times) -> opponent accepts one -> `pending_staff` -> staff approve -> `approved` (the match's `scheduled_at` becomes the accepted time). Exits: `declined_opponent`, `declined_staff` (a note is required), `cancelled` (the requester, only while `pending_opponent`).

- **Opponent confirms in the portal** (decided 24 Oct). Once the opponent has accepted, the requester can no longer cancel, which is what "neither side can revert" amounts to in the data.
- **Staff approval is deliberate but provisional.** It is a separate step (`pending_staff`) so it can be removed later by letting the opponent's acceptance move the match; nothing else depends on the staff step except `approveReschedule` and `RescheduleQueue`. Keep that seam if it is dropped.
- **At most one open request per match** (partial unique index on `match_id` where status is open), so a second request waits for the first to resolve.

## Rules enforced (server side; `app/lib/reschedule-rules.ts` is the one source)

- 2 to 5 proposed times, each a real future instant, none equal to the match's current time, no two less than an hour apart (`validateProposedTimes`). Times arrive as Eastern wall-clock strings and are parsed with `parseEastern`.
- **Late** (under 72 hours before the match, `isLateRequest`): stored in `is_late` at creation. It never blocks a request; the opponent decides, and both the request dialog and the response dialog say so.
- Only a still-`scheduled`, not-yet-started match between two different schools can be requested. A match between two squads of one school is moved by staff.
- Only the two schools' managers act, in the match's own season and game, and only on an active season (`assertManagerForSchoolGame` with its default write guard, so spec-028 view-only seasons are refused). Staff admins are refused here: they act from the staff portal.
- Every state change is a conditional update (`where status = <expected>` and `returning`), so two simultaneous answers cannot both win; the loser gets "already resolved".
- Approval runs in one transaction and refuses (rolling back) when the request is not `pending_staff`, the accepted time has passed, or the match is no longer `scheduled` at `original_scheduled_at`, so an approval never overwrites a newer schedule. Its closing write re-checks `status = 'pending_staff'`, so a decline committed in between wins and the match move rolls back.
- The opponent can always decline, even after the match moved or started (only accepting needs the match unchanged), so a stale request cannot sit open and block the match's next one.
- Manager actions return refusals as `{ success: false, error }` instead of throwing, because Next.js redacts a thrown server-action message in production (`ActionError` + `withActionErrors`); an unexpected failure is logged and shown as a generic message, so a missing table never surfaces raw SQL.

## Not enforced (staff judge it from the queue)

- **Forfeits** for a missed on-time reschedule or a missed season deadline are never automated (decided 24 Oct); staff record them on the result.
- **End of regular season:** `seasons` has no end date, so a proposed time past the season's end is not checked.
- **"Cannot reschedule if both teams already agreed to the original date":** nothing records that agreement.

## Known limits (accepted for now)

- A user who manages both schools of a match could request and accept alone; staff approval is the backstop (and a reason to think twice before dropping that step).
- After `approved`, either school may immediately request a new move of the same match; nothing limits repeat requests.
- The approval guard compares `scheduled_at` for equality; a match time stored with sub-millisecond precision (only possible from raw SQL) would always read as "changed".
- Staff admins viewing a school's portal see the request buttons; the server refuses them.

## Data

- `match_reschedule_requests`: `match_id` and `requested_by_school_id` (both cascade), `requested_by_user_id`, `reason`, `status` (CHECK), `is_late`, `original_scheduled_at`, `accepted_option_id`, opponent responder and time, `decided_by_staff_id`, `decided_at`, `staff_note`, audit columns. RLS enabled, no policies (server-only access, like the other portal tables).
- `match_reschedule_options`: `request_id` (cascade), `proposed_at`, unique per request and time.
- Migration `db/migrations/0053_match_reschedule_requests.sql` is hand-written and journaled (idx 53) because `drizzle-kit generate` still aborts on the 0041/0042 snapshot collision (open thread); the schema in `app/lib/db/schema.ts` matches it.

## Surfaces

- **Portal** (`MatchesSection` -> `RescheduleCell`, `RescheduleControls.tsx`): Upcoming rows get a Reschedule column. No request: "Request reschedule" dialog (reason, 2-5 `datetime-local` times labelled ET). Waiting on the opponent: the requester sees "Waiting for <opponent>" and View request (a dialog with the reason, the proposed times and, while the opponent has not answered, Cancel request); the opponent sees "<requester> requested a reschedule" and Respond (pick a time and accept, or decline). Waiting on staff: shows the agreed time and View request. Declined: the label and the staff note. Moved by an approved request: the status chip reads "Rescheduled" (instead of "Scheduled"), the When column shows "Rescheduled · was <old time>", and the Reschedule column says "Rescheduled · Moved from <old time>". `getSchoolMatches` attaches each match's latest request (`getLatestRescheduleRequests`) and, separately, when the match was last moved (`getRescheduledFrom`, from the latest approved request, so the marker survives a later declined or cancelled request); both fail soft so the schedule still renders if a lookup fails. Actions call `router.refresh()` on success.
- **Staff** (`RescheduleQueue`, between the header and filters on `/admin/matches`): requests in `pending_staff` with the current and new time in ET, who asked, a Late flag, the reason, a note box (required to decline), Approve and Decline. Renders nothing when empty. The page loads it fail-soft so a queue problem cannot hide the results page. Approve moves the match and refreshes the `matches`, `rosters` and `teams` tags like the other match actions.

## Invariants & Boundaries

- A request never changes `matches.scheduled_at`; only `approveReschedule` does, inside its transaction.
- Authorization and every rule above live in server actions; the UI only decides what to show.
- No notifications beyond the portal (email and a Discord bot are later, per decision).

## Verification

- `app/lib/__tests__/reschedule-rules.test.ts` (rules, boundaries, `canRequestReschedule`), `app/lib/onboarding/__tests__/reschedule-actions.test.ts` (authorization, each refusal, late flag, ET parsing, accept/decline/cancel races), `app/(admin)/admin/matches/__tests__/reschedule-actions.test.ts` (permission, approve transaction and stale guards, decline needs a note), and extended `school-matches.test.ts`. The actions run against a queued-result mock of the query builder, so they prove the control flow and the values written, not the SQL.
- Migration 0053 was applied to an in-memory Postgres (PGlite) with stand-in `matches` and `schools` tables: the open-request unique index, status CHECK, option uniqueness, cascade delete and RLS all behave. It has not been run against a real Supabase database.
- Rendered with mock data in a local dev server (no database): every request state in the Upcoming table, the request dialog (late notice, the one-hour validation message, focus inside, Escape closes), the response dialog, the staff queue, and the request dialog at 375px (fits, no page overflow). The accept, decline, cancel, approve and decline buttons were not exercised end to end because they call the real actions.
- Not done: an end-to-end run with real data (needs a local Postgres with `0053` applied and a manager login).
