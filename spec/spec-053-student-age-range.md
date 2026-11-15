# spec-053: Student onboarding accepts only ages 13 to 21

- **Spec ID:** spec-053
- **Title:** Restrict the accepted date of birth in student onboarding to NYC high-school age
- **Status:** Implemented on branch `feat/onboarding-nyc-hs-age-limit`, unmerged. No migration.
- **Date:** 2026-11-01
- **Scope:** `app/lib/onboarding/consent.ts`, `app/lib/onboarding/wizard/submission-pipeline.ts`, `components/steps/BirthDateRulesStep.tsx`, `hooks/useWizardDraft.ts`, `PlayerOnboardingWizard.tsx`, and the tests that submit a date of birth.
- **Builds on:** [spec-029](spec-029-onboarding-consent-form.md) (age from DOB drives the guardian flow), [spec-051](spec-051-google-form-onboarding.md) (DOB validated, not stored).

## Rule

Age is whole years from the submitted date of birth (`calculateAge`, New York calendar date). Accepted: `MIN_STUDENT_AGE` 13 to `MAX_STUDENT_AGE` 21, inclusive (constants next to `ADULT_AGE` in `consent.ts`, with `isStudentAgeInRange` and `STUDENT_AGE_RANGE_MESSAGE`).

Why: NYC kindergarten requires turning 5 by 31 Dec, so incoming 9th graders are usually 13-14 and seniors 17-18; NY Education Law entitles students to public school through the end of the school year in which they turn 21, so over-age students up to 21 exist.

## Enforcement

- **Server (authoritative):** `validateSubmissionInputs(submission, now, { enforceStudentAge })` throws `STUDENT_AGE_RANGE_MESSAGE` before consent validation. The age is computed from `birthDate`, never client-supplied. The caller passes `enforceStudentAge: !isManager || submission.alsoPlays === true`.
- **Client:** `BirthDateRulesStep` shows an inline `role="alert"` message and marks the input `aria-invalid`; `validateStep4` in `useWizardDraft` blocks Next with the same message.
- **Managers who do not play are exempt** (school staff). A manager who ticks "I also play" (spec-043, chosen in step 1, so known by the birth date step) is age-limited like a student, client-side (`enforceStudentAge={!isManagerInvite || draft.alsoPlays}`, `validateStep4`) and on submit.
- The under-18 guardian flow is unchanged and still covers 13-17.

## Tests

Boundaries in `consent.test.ts` (12 rejected, 13 accepted, 21 accepted, 22 rejected, day-before and day-of birthday, New York midnight edge); pipeline rejection in `milestone4-player-wizard.test.ts`; inline error in `content-flag.test.tsx`. Player fixtures that used out-of-range DOBs now compute a DOB relative to the current year (always age 19) so they do not expire.

## Pitfalls

In-flight player drafts with an out-of-range DOB are not migrated; the person is stopped at step 4 and on submit.
