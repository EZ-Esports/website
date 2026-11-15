# spec-032: Match Reschedule Requests

- **Spec ID:** spec-032
- **Title:** Managers request a reschedule in the portal; the opponent agrees; staff approve
- **Status:** Implemented, merged. Migration 0053 applied to production on 25 Oct 2026; a live end-to-end check against the production database passed (see Verification).
- **PR / Commit:** [PR #276](https://github.com/EZ-Esports/website/pull/276) (merge `9dbacdf`)
- **Date:** 2026-10-25
- **Scope:** two new tables (migration `0053`), manager server actions, staff server actions, a request column in the portal Matches section, a staff queue on `/admin/matches`. Part 2 of [#274](https://github.com/EZ-Esports/website/issues/274); part 1 is [spec-031](spec-031-manager-matches-view.md).

## Context & Motivation

Rules page 4.3 sets the league's rescheduling rules (72 hours, two proposed times, no reverting once agreed). Until now a reschedule was agreed outside the site and staff edited the match. Managers must never move a match themselves: a request only proposes, and the match keeps its time until staff approve.

## Flow and statuses

`pending_opponent` (requester proposed 2-5 times) -> opponent accepts one -> `pending_staff` -> staff approve -> `approved` (the match's `scheduled_at` becomes the accepted time). The opponent's other two answers: decline (`declined_opponent`), or **counter** with 2 to 5 times of their own (`pending_requester`), after which the requester accepts one of those (`pending_staff`) or declines (`declined_requester`). Staff exits: `approved`, `declined_staff` (a note is required). `cancelled`: the requester while `pending_opponent`; either school while `pending_requester`.

- **Counter-offers are one round** (decided 25 Oct). Each time carries `proposed_by` (`requester` or `opponent`), and a school can only pick the other side's times: the opponent from the requester's set, the requester from the counter set. The requester cannot counter the counter; they accept or decline, and can always send a fresh request after a decline. A counter time may not repeat one the requester already offered (the opponent should accept it). The same rules as a request apply to counter times (2 to 5, future, an hour apart), and the opponent's `opponent_responded_*` columns record the counter while `counter_responded_*` records the requester's answer to it.
- **Either school may cancel a waiting counter-offer** because nobody has agreed to anything yet; this also stops an ignored counter-offer from blocking the match's next request.
- **Opponent confirms in the portal** (decided 24 Oct). Once a time has been accepted, nobody can cancel, which is what "neither side can revert" amounts to in the data.
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

- A user who manages both schools of a match could request and accept alone; staff approval was the backstop (and a reason to think twice before dropping that step). Superseded: staff approval was removed in [spec-054](spec-054-reschedule-no-staff-approval.md), so there is now no backstop.
- After `approved`, either school may immediately request a new move of the same match. Each school is limited to one request per season across all its matches ([spec-039](spec-039-one-reschedule-per-season.md)), but nothing stops a second move by the other school.
- The approval guard compares `scheduled_at` for equality; a match time stored with sub-millisecond precision (only possible from raw SQL) would always read as "changed".
- Staff admins viewing a school's portal see the request buttons and can use them as the viewed school, after a confirm dialog ([spec-055](spec-055-staff-act-in-manager-portal.md)); this was once refused by the server.
- A second request on a match that already has an open one returns the generic "Could not send the request" message instead of the friendly one ([#277](https://github.com/EZ-Esports/website/issues/277)); no data is affected, and the portal hides the button while a request is open.
- While a tour step shows, the page is inert, which also blocks wheel and touch scrolling inside inner containers such as the matches table; a Matches step whose table is wider than a phone screen cannot be scrolled sideways during the tour (window scrolling still works).
- The moved-from marker comes from the latest approved request; a later manual staff edit of a match's time leaves the "was ..." text unchanged.

## Data

- `match_reschedule_requests`: `match_id` and `requested_by_school_id` (both cascade), `requested_by_user_id`, `reason`, `status` (CHECK), `is_late`, `original_scheduled_at`, `accepted_option_id`, opponent responder and time, requester's counter responder and time, `decided_by_staff_id`, `decided_at`, `staff_note`, audit columns. RLS enabled, no policies (server-only access, like the other portal tables).
- `match_reschedule_options`: `request_id` (cascade), `proposed_at`, `proposed_by` (`requester` default, or `opponent`, CHECK), unique per request and time.
- Migration `db/migrations/0053_match_reschedule_requests.sql` is hand-written and journaled (idx 53) because `drizzle-kit generate` still aborts on the 0041/0042 snapshot collision (open thread); the schema in `app/lib/db/schema.ts` matches it.

## Surfaces

- **Portal** (`MatchesSection` -> `RescheduleCell`, `RescheduleControls.tsx`): Upcoming rows get a Reschedule column. No request: "Request reschedule" dialog (reason, 2-5 `datetime-local` times labelled ET). Waiting on the opponent: the requester sees "Waiting for <opponent>" and View request (a dialog with the reason, the proposed times and, while the opponent has not answered, Cancel request); the opponent sees "<requester> requested a reschedule" and Respond (pick a time and accept, decline, or "Suggest other times", which swaps the dialog to 2-5 time pickers). After a counter-offer the requester sees "<opponent> suggested other times" and Respond (pick one of the opponent's times and accept, or decline; no second counter), while the opponent sees "Waiting for <requester> to choose" and View request, and either school can cancel from the View dialog, which lists "You proposed" and "<school> suggested" separately. Waiting on staff: shows the agreed time and View request. Declined: the label and the staff note. Moved by an approved request: the status chip reads "Rescheduled" (instead of "Scheduled"), the When column shows "Rescheduled · was <old time>", and the Reschedule column says "Rescheduled · Moved from <old time>". `getSchoolMatches` attaches each match's latest request (`getLatestRescheduleRequests`) and, separately, when the match was last moved (`getRescheduledFrom`, from the latest approved request, so the marker survives a later declined or cancelled request); both fail soft so the schedule still renders if a lookup fails. Actions call `router.refresh()` on success.
- **Division filter and tutorial:** `MatchesSection` offers "All divisions / Varsity / Junior Varsity" (only the divisions present, shown when there are two or more; `divisionOptions` and `filterByDivision` in `school-matches.ts`), applied before the Upcoming/Past split so the tab counts follow it. A new "Matches" tour section (`steps.ts`, spec-015's single definition) has two steps anchored on `data-tour="matches"` (the section) and `data-tour="reschedule"` (the Reschedule column header, Upcoming tab only, so the step is dropped when the Past tab is open). Managers who already finished the first-run tour do not see it again automatically; they can play it from the Tutorial menu.
- **Staff** (`RescheduleQueue`, between the header and filters on `/admin/matches`): requests in `pending_staff` with the current and new time in ET, who asked, a Late flag, the reason, a note box (required to decline), Approve and Decline. Renders nothing when empty. The page loads it fail-soft so a queue problem cannot hide the results page. Approve moves the match and refreshes the `matches`, `rosters` and `teams` tags like the other match actions.

## Invariants & Boundaries

- A request never changes `matches.scheduled_at`; only `approveReschedule` does, inside its transaction.
- Authorization and every rule above live in server actions; the UI only decides what to show.
- No notifications beyond the portal (email and a Discord bot are later, per decision).

## Verification

- `app/lib/__tests__/reschedule-rules.test.ts` (rules, boundaries, `canRequestReschedule`), `app/lib/onboarding/__tests__/reschedule-actions.test.ts` (authorization, each refusal, late flag, ET parsing, accept/decline/cancel races), `app/(admin)/admin/matches/__tests__/reschedule-actions.test.ts` (permission, approve transaction and stale guards, decline needs a note), and extended `school-matches.test.ts`. The actions run against a queued-result mock of the query builder, so they prove the control flow and the values written, not the SQL.
- Migration 0053, in its final form (including counter-offers), was applied to an in-memory Postgres (PGlite) with stand-in `matches` and `schools` tables: the open-request unique index (also covering `pending_requester`), both CHECKs, option uniqueness, the `proposed_by` default, cascade delete and RLS all behave. It was then applied to the production Supabase database on 25 Oct 2026 (see the live check below).
- **0053 was amended in place** to add counter-offers, on the basis that it had never been applied anywhere. Every statement is `IF NOT EXISTS` and the journal will not re-run a recorded index, so if 0053 was ever applied in its earlier form (a Supabase branch, a dev database), the amendment silently does nothing there: add a `0054` for `proposed_by`, the `counter_responded_*` columns, the two statuses and the wider index predicate instead. It was applied to production once, in its final form, so the caveat no longer applies there.
- The action tests also assert the SQL parameters the actions filter by (a stand-in cannot run SQL but it can see its inputs): the opponent's accept is limited to `proposed_by = 'requester'` times and the requester's to `'opponent'` times, and every answer or cancel writes only over the status it read. `app/lib/db/__tests__/reschedules.test.ts` covers `getRescheduledFrom` (approved only, newest move wins). `tour/__tests__/inert.test.ts` covers the view-only lock helper; the lock's lifecycle inside `PortalTour` was checked in the browser, not by a unit test.
- Rendered with mock data in a local dev server (no database): every request state in the Upcoming table, the request dialog (late notice, the one-hour validation message, focus inside, Escape closes), the response dialog, the staff queue, and the request dialog at 375px (fits, no page overflow). The accept, decline, cancel, approve and decline buttons were not exercised end to end because they call the real actions.
- **Applied to production, 25 Oct 2026**, through `npm run db:migrate` (the guarded script: the exact host named in `SEED_ALLOW_REMOTE`, and a fresh pre-migration backup of the affected tables taken first). Only 0053 was pending. A read-only check of the live catalog then matched the migration exactly: both tables and every column, the open-request partial index (including `pending_requester`), both CHECKs, the cascading foreign keys, and RLS on with no policies.
- **Live end-to-end check (25 Oct 2026):** the real actions and read queries ran against the production database inside a single transaction on one held connection that is always rolled back, with only the auth guards faked (no browser session). Nine scenarios passed: request, counter-offer, the requester accepting, staff approval moving the match to exactly the agreed instant; the late flag; declines freeing the match for a new request; cancel rules per status; a staff decline needing a note; stale-match and passed-time guards; hiding matches against a soft-deleted school; cascade delete; and the proposer rule (a school cannot accept its own proposed time, which the mocked tests cannot prove). A follow-up query confirmed nothing was left behind. The test file was temporary and is not in the repository.
- Found by that run: [#277](https://github.com/EZ-Esports/website/issues/277) (a second request on a match with an open one shows the generic error instead of the friendly message, because `isUniqueViolation` reads the code from the wrong level of drizzle's wrapped error) and [#278](https://github.com/EZ-Esports/website/issues/278) (a foreign-key name in 0053 is over 63 characters and stored truncated).
- Not done: the same flow through a real manager and staff browser session (sign-in was faked in the live check).
