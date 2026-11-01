# spec-054: Staff admins can act in a school's manager portal

- **Spec ID:** spec-054
- **Title:** A staff admin viewing a school's portal can perform every manager action as that school, behind one confirmation
- **Status:** Implemented on branch `worktree-remove-reschedule-staff-approval`, unmerged (builds on spec-053's uncommitted work). No migration. Covered by unit and jsdom tests with mocked actions and database; not exercised against a real database or by a logged-in staff user in a browser.
- **Date:** 2026-11-01
- **Scope:** `app/lib/onboarding/reschedule-actions.ts` (`authorizeForMatch`, `requestRescheduleImpl`), `app/(portal)/portal/components/StaffActing.tsx` (new), `SchoolPortalClient.tsx`, `GenerateInviteCard.tsx`, `RescheduleControls.tsx`, `MatchResultControls.tsx`, `MatchesSection.tsx`, and their tests.
- **Amends:** [spec-032](spec-032-match-reschedule-requests.md) (staff were refused), [spec-039](spec-039-one-reschedule-per-season.md) (staff exempt). Builds on [spec-028](spec-028-manager-past-season-view-only.md) and the roster lock, which staff already bypassed.

## Audit

Staff admins (ADMINISTRATOR, `isStaffAdmin`) already bypassed the manager checks in `manager-auth.ts` (school, game, season-active, roster lock, season match). Every server action a manager can trigger from the portal:

| Action | File | Staff before | Staff now |
| --- | --- | --- | --- |
| `createPlayerInvite` | portal-actions | Worked (invite stamped with the game's active season) | Unchanged |
| `regeneratePlayerInviteLink`, `deletePlayerInvite` | portal-actions | Worked | Unchanged |
| `reviewPlayerInvite` | portal-actions | Worked (reviews any invite) | Unchanged |
| `createSchoolRoster`, `deleteSchoolRoster` | portal-actions | Worked | Unchanged |
| `enrollPlayerToRoster`, `removePlayerFromRoster`, `movePlayerToRoster`, `updateRosterPlayerRole`, `emergencySwapSub` | portal-actions | Worked (enroll skips the accepted-application rule) | Unchanged |
| `getSchool*`, `getPendingSubmissions`, `getRosterEligibility`, `getMatchScoreboardAction` | portal-actions, match-result-actions | Worked (reads) | Unchanged; no confirmation (reads) |
| `submitMatchResult`, `retryMatchResult`, `cancelPendingResult` | match-result-actions | Worked server-side (school must be a side of the match; season check skipped) | Unchanged on the server; attempts are attributed to the staff user id |
| `requestReschedule`, `respondToReschedule`, `counterReschedule`, `cancelReschedule` | reschedule-actions | Refused ("Staff move matches from the staff portal.") | Allowed; see below |
| `completePortalTour` | tour-actions | No-op (no manager row) | Unchanged |

So the only refusal was in reschedules. The wizard and Google Form actions are player-facing, not manager actions.

## Reschedules as a school

- The UI passes the viewed school's id as `schoolId` (as it already did for managers). The server validates it: it must be one of the two schools of the match, and the match's season is not compared to the staff user (they have no season). The side is derived from `schoolId` alone, exactly as for a manager: the requester is `requestedBySchoolId`, the answering side follows the request status, and a school cannot answer its own request.
- Attribution: `requested_by_user_id`, `opponent_responded_by_user_id`, `counter_responded_by_user_id` hold the acting user's id, so a staff action carries the staff user id and `requested_by_school_id` the viewed school. There is no `acted_as_staff` column; staff are told apart by joining the user id to staff roles. Adding an explicit flag would need a migration and was left out.
- Exemptions: staff skip the one-request-per-season count (the school row lock and count still run, the result is ignored) and the portal shows them "Request reschedule" on a match that was already moved or whose school used its allowance, and hides the allowance banner. The open-request unique index still allows one open request per match. A match between two squads of one school is still refused ("moved by staff"): requester and responder would be the same school, so the side is ambiguous; staff edit that time on `/admin/matches`.

## Confirmation

One mechanism, `StaffActingProvider` (`components/StaffActing.tsx`), mounted by `SchoolPortalClient` around the portal:

- `useStaffActing()` returns `{ isStaff, confirmed(run), actingNotice }`. For a manager `confirmed(run)` just calls `run()` and `actingNotice` is empty, so managers see no dialog and no behavior change. Without a provider (isolated components, tests) the hook returns the manager value.
- For a staff admin `confirmed(run)` opens the portal-styled `ConfirmActionDialog` ("Act as this school?" / "You're acting as <School> as staff. Confirm?"), driven by `useConfirmAction`, and runs `run` only on Confirm; Cancel or Escape never runs it.
- Applied at the point a control starts a server mutation, after its client-side validation: approve and reject an application, enroll, create roster, change a player's role, move a player, create an invite, and every reschedule and result action (`useRescheduleAction.run`, `useResultAction.run`). Controls that already had their own confirm dialog (copy a new invite link, delete invite, remove player, delete roster, discard saved match IDs) show one dialog: the staff notice leads their message, so staff do not confirm twice.
- Authorization is unchanged and server-side; the UI only decides what to show.

## Risks and notes

- A confirm dialog opened from inside another modal (Send request, Accept, Send these times) stacks on top of it; the jsdom test covers cancel from the View dialog, not every stacked case, and it was not checked in a real browser.
- The one-request-per-season exemption means a staff admin can chain reschedules of one match; the accepted-time guards still apply, and spec-053 already removed the staff backstop.
- Result submissions by staff count toward the per-user submission throttle under the staff user id.

## Tests

`reschedule-actions.test.ts`: staff request records the staff user and viewed school, is exempt from the limit, still refused for a non-playing school and a one-school match; staff accept, counter and cancel; the side is still derived from the viewed school; a manager keeps the limit. `match-result-actions.test.ts`: staff submit is attributed to the staff user, and refused for a non-playing school. `components/__tests__/staff-acting.test.tsx`: no dialog for a manager or without a provider; dialog, Confirm and Cancel for staff. `reschedule-cell-staff.test.tsx`: allowance hides Request for a manager but not staff; cancel is immediate for a manager and waits for Confirm for staff.
