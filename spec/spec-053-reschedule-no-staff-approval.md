# spec-053: Reschedules no longer need staff approval

- **Spec ID:** spec-053
- **Title:** An accepted reschedule time moves the match at once; the staff approve/decline step and queue are removed
- **Status:** Implemented on branch `worktree-remove-reschedule-staff-approval`, unmerged. No migration. Not exercised against a real database or in a browser; covered by unit tests with a mocked database.
- **Date:** 2026-11-01
- **Scope:** `app/lib/onboarding/reschedule-actions.ts` (`respondToRescheduleImpl`), `app/lib/reschedule-rules.ts`, `app/lib/db/reschedules.ts`, `RescheduleControls.tsx`, `portal/tour/steps.ts`, the `/admin/matches` page, and their tests. Deleted: `app/(admin)/admin/matches/reschedule-actions.ts` (`approveReschedule`, `declineReschedule`) and its test, `app/components/admin/RescheduleQueue.tsx`, `getStaffRescheduleQueue`, `StaffRescheduleItem`, `canStaffDecide`, `MAX_STAFF_NOTE_LENGTH`.
- **Amends:** [spec-032](spec-032-match-reschedule-requests.md) (status flow). [spec-039](spec-039-one-reschedule-per-season.md) is unchanged.

## Why

The staff step was a removable seam (spec-032): only `approveReschedule` and `RescheduleQueue` depended on it. Both schools have already agreed, so staff review added delay without a decision to make.

## Behavior

- When the opponent accepts one of the requester's times (`pending_opponent`), or the requester accepts one of the opponent's counter-times (`pending_requester`), one transaction (a) moves `matches.scheduled_at` to the accepted time and (b) sets the request to `approved` with `accepted_option_id` and the responder columns. The request never enters `pending_staff` now.
- Guards, taken from `approveReschedule`: the request must still be in the status the responder was shown (conditional update with `returning`), the accepted time must not have passed (checked before the transaction), and the match must still be `scheduled` at the request's `original_scheduled_at` (conditional update with `returning`). If either write matches no row the action throws inside the transaction, so both roll back and the loser of a race gets "changed since" or "already resolved".
- After commit: `updateTag('matches')`, `updateTag('rosters')`, `updateTag('teams')`, and `revalidatePath` for `/admin/matches`, `/portal` and `/`.
- Portal: the "Waiting for staff" label, the "staff still have to approve" note, the accept-dialog warning about staff, and the tour sentence about staff approval are gone; the accept dialog says the match moves right away. A legacy `pending_staff` row reads "Pending" so it never shows a wrong counter-offer label.
- Staff can still edit a match time directly on `/admin/matches`.
- `decided_by_staff_id`, `decided_at` and `staff_note` stay in the schema and are null on requests approved this way. Historical `declined_staff` rows and staff notes still display.

## Kept on purpose (no migration)

`pending_staff` stays in the CHECK constraint, `RESCHEDULE_STATUSES`, the open-request partial unique index and `OPEN_RESCHEDULE_STATUSES`, so existing rows stay valid and still block a second open request for their match. Nothing writes it.

## Risks

- Pre-existing `pending_staff` rows in production are stranded: no UI can approve or decline them, and they keep blocking new requests on their match. See [open-threads.md](open-threads.md).
- The spec-032 Known limit "a user who manages both schools of a match could request and accept alone; staff approval is the backstop" now has no backstop.
- The one-request-per-season limit (spec-039) is the only remaining brake on repeated moves.

## Tests

`onboarding/__tests__/reschedule-actions.test.ts`: an accept by the opponent and by the requester moves the match and approves in one step, the writes carry the status and original-time guards, and a stale match or lost race returns an error without refreshing caches. `reschedule-rules.test.ts`: `canStaffDecide` removed. `steps.test.ts`: tour copy no longer mentions staff approval. The staff action tests were deleted with the action.

## Follow-up: date pickers

- A proposed-date field ignores input once the year passes four digits (browsers allow up to six), `validateProposedTimes` rejects any year above 9999 server-side, and each date row gets a Remove button while more than the minimum (2) rows are shown, so an opened-but-unneeded row can be dropped.
