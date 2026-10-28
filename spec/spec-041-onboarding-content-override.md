# spec-041: Student Override for Flagged Onboarding Fields

- **Spec ID:** spec-041
- **Title:** A student may confirm a flagged field is their real information; staff review the confirmed rows
- **Status:** Implemented on branch `feat/onboarding-profanity-filter`, not yet merged. Migration `0055` applied to the local scratch database only; **not yet applied to production**.
- **PR / Commit:** pending (branch `feat/onboarding-profanity-filter`)
- **Date:** 2026-10-28
- **Scope:** the join wizard, the submission pipeline, the new `onboarding_content_overrides` table, and the school roster page. Builds on [spec-040](spec-040-onboarding-profanity-filter.md).

## Behaviour

- When the filter flags a typed field, a checkbox appears under it: "This is my real information, and I confirm it is not offensive." Continue stays blocked until every flagged field is fixed or confirmed.
- A confirmation is tied to the exact value it was ticked against. Editing the field clears it. Confirmations are not saved in the draft, so a reload needs a new tick.
- The submission carries `contentOverrides` (field keys). The server accepts a flagged field only when it is listed. Keys for unflagged fields are dropped. A rejected submission writes nothing.
- Each accepted override is stored in `onboarding_content_overrides` (member, field, the typed value up to 1000 characters, time, and review fields). Resubmission replaces only unreviewed rows; reviewed rows are kept as a record.
- The school roster page (`MANAGE_ROSTERS`) shows a notice on each member with overrides. "Mark reviewed" sets `reviewed_at`, `reviewed_by` and an optional note. A review is final: a second call does not overwrite it.

## Which fields

- Screened for every applicant: legal first and last name, Riot ID, country of birth, primary language at home, the "anything else" answer.
- Minors only: guardian name, relationship and signature. The participant name on the consent form is also minors only; adults see no such field and their legal name is already screened in Step 1. (A bug in the first version blocked adults whose legal name was flagged. Fixed in this change.)

## Data and access

- Table `onboarding_content_overrides`: `member_id` references `members` (cascade), RLS on with no policies, matching `match_reschedule_requests`.
- Writes happen inside the same transaction as the member upsert, so an override cannot exist without its member.
- Only `MANAGE_ROSTERS` can read or review the rows. The action checks that the override's member belongs to the school in the URL.
- The purge script (`db/purge-onboarding-test-data.ts`) removes override rows only for non-staff members, like `onboarding_consents`.

## Deploy requirement

**Migration `0055` must be applied to production before this code ships.** The submission path and the roster page both read or write the table. Without it, every onboarding submission fails and the roster page shows a database error.

## Known limits

- Confirmations are per session and per value, so students re-tick after a reload.
- Staff review is manual; there is no automatic action on overridden rows.
- The override only records intent; it does not change how the value is shown to staff elsewhere.
