# spec-029: Onboarding consent form (Terms of Service and guardian authorization)

- **Status:** Implemented on branch `worktree-onboarding-consent-forms`, not yet merged. Migration `0052` written, **not applied to production**.
- **Date:** 2026-10-23
- **Why:** Legal requires the EZ Esports Onboarding Consent Form in both the manager and the student onboarding wizards, recorded in the database and enforced server-side.

## What shipped

- **New wizard step 5, "Terms & Authorization"**, in the shared `/join/[schoolSlug]/[gameSlug]` wizard, so it applies to player and manager invites alike (`components/steps/ConsentStep.tsx`; the stepper is now 5 steps). It follows Step 4 on purpose: Step 4 collects the date of birth the age rule needs.
- **Under 18:** the full form is shown, in the order and wording supplied by legal: "You have entered your age as N..." intro, Terms of Service link, 1. ToS acknowledgment checkbox, 2. participant full legal name (prefilled from Step 1, editable), 3. the four authorization statements, 4. guardian full legal name / relationship / email, 5. electronic signature (initials or full name) and a read-only date.
- **18 and over:** only "1. Terms of Service Acknowledgment" (the link and the checkbox) is shown. **Assumption to confirm with legal:** the supplied form is a guardian authorization; showing adults just the ToS checkbox is our minimal reading. No text was invented.
- **Terms link:** the existing `/terms` page (`ROUTES.terms`, exported as `TERMS_OF_SERVICE_PATH` in `consent.ts`), opened in a new tab so wizard state survives.
- **Age rule:** `calculateAge(birthDate)` from the date of birth already collected in Step 4 (`student_demographics.birth_date`), on the New York calendar date. The client uses it to choose what to show; the server recomputes it from the submitted date of birth and never trusts a client-sent age. A date of birth outside `MIN_BIRTH_DATE` (1900-01-01) to today is now rejected (`isPlausibleBirthDate`), on the server and in Step 4; the date input also carries `min`/`max` and drops 5-6 digit years typed into native date inputs.
- **Date:** displayed read-only on the client; the stored `signed_at` is stamped server-side inside the submission transaction.

## Server enforcement

`validateSubmissionInputs` (`wizard/submission-pipeline.ts`) calls `validateConsent` (`app/lib/onboarding/consent.ts`), which throws unless `consent.tosAcknowledged === true`, and for under-18s unless the participant name, guardian name, relationship, a valid guardian email and a signature of 2+ characters are present. It runs before any write, so a direct server-action call without consent creates no member, no identity and no invite transition. Error messages never echo submitted values. Validation is hand-rolled to match the pipeline's existing style (no zod there). `sanitizeDraftData` strips `consent`, so guardian PII and the signature are never saved in `submission_draft`.

## Data

Migration `0052_onboarding_consents.sql` (hand-written like `0043`-`0051`; journal entry only, no snapshot) adds `onboarding_consents`: `member_id` (cascade), `school_id` (set null), `invite_kind` + `invite_id` (unique together, no FK because it spans `player_invites` and `manager_invites`), `form_version`, `is_minor`, `age_at_signing`, `tos_acknowledged`, `participant_legal_name`, nullable `guardian_*` fields, `signed_at`. CHECK constraints require `tos_acknowledged = true` and all guardian fields when `is_minor`. RLS enabled, no policies (service role only), like `student_demographics`. One row is inserted per submission in the same transaction as the member, identities and demographics (`insertOnboardingConsent` in `app/lib/db/onboarding.ts`).

## Form versioning

`CONSENT_FORM_VERSION` (`2026-10-v1`) is stored on every row. `CONSENT_TEXT` is legal wording; `consent.test.ts` pins a SHA-256 of it, so editing the text fails the test until the version is bumped and the pin updated. The wording itself is not stored per row; the version identifies it.

## Not done / follow-ups

- No staff UI to view or export consent records (see open-threads).
- Existing members onboarded before this change have no consent row; there is no re-consent flow.
- Guardian email is collected but no email is sent to the guardian.
- Date of birth is self-reported, so age gating is only as good as that field.

## Tests

`consent.test.ts` (text pin, age maths, validation), `milestone4-player-wizard.test.ts` (consent persisted for adults and minors, blocked when missing or invalid, not kept in drafts, future DOB), `ConsentStep.test.tsx` (adult vs minor rendering). Existing submission fixtures gained `consent: { tosAcknowledged: true }`. The migration SQL was not run against a Postgres (none available locally).
