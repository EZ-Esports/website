# spec-062: Consent form relationship is a dropdown (Mother, Father, Guardian)

- **Spec ID:** spec-062
- **Title:** Replace the free-text "Relationship to Participant" on the under-18 consent form with a fixed list
- **Status:** Implemented in the working tree, not yet committed or deployed. No migration.
- **Date:** 2026-11-08
- **Scope:** `app/lib/onboarding/consent.ts`, `components/steps/ConsentStep.tsx`, `consent.test.ts`, `milestone4-player-wizard.test.ts`; plus the two follow-ups below (consent rejection routing, Apps Script title match).
- **Builds on:** [spec-029](spec-029-onboarding-consent-form.md) (consent form, versioning).

## Change

- Step 5, section 4: "Relationship to Participant" is a native `<select>` with **Mother**, **Father**, **Guardian** and a "Select one" placeholder. The list lives in `CONSENT_TEXT.guardianRelationshipOptions`, shared by the UI and the server.
- `validateConsent` (the authoritative check) rejects any value outside the list, so a hand-built request cannot store free text. The match is exact (after trimming); `Parent`, `mother` and `Uncle` are rejected.
- `CONSENT_FORM_VERSION` bumped `2026-10-v1` to `2026-11-v1` and the pinned hash in `consent.test.ts` updated, as spec-029 requires for any change to what the form collects. Consents signed earlier keep `2026-10-v1`.

## Why this does not break invites or drafts

- The relationship is not part of an invite, token or Google Form. It is only read when the wizard is submitted.
- Guardian fields are deliberately never saved in drafts (`useWizardDraft`), so no saved draft can hold an old free-text value that the list would not recognise.
- `onboarding_consents.guardian_relationship` stays `text`. Existing rows ("Mother", "Parent", anything typed) are untouched; nothing reads them back into the form.
- The offensive-content screen no longer runs on this field in the UI (fixed values cannot be flagged). The server-side field entry in `content-check.ts` is left as is.

## Edge

A person who has the wizard open when this deploys and submits an old-style value ("Parent") gets the new validation message and must pick from the list. Only under-18 students reach this form; managers are adults.

## Follow-up A: consent failures return to Step 5 with the real message

`validateConsent` threw a plain `Error`, which `submitPlayerOnboarding` rethrows and Next.js masks in production, so a student with a pre-deploy tab saw a generic error on the last step. The submission pipeline now wraps it in `OnboardingRejection('consent_invalid', message)`; `stepForRejection('consent_invalid')` is 5; the wizard shows the message on Step 5 and keeps the Discord connection (it only clears it for target 2). Messages never echo submitted values (PII). Tests: a minor with relationship `Mom` yields a `consent_invalid` result, not a throw, with nothing stored; `stepForRejection` maps to 5.

## Follow-up B: Apps Script tolerates a reworded verification question

`findVerificationCode_` now matches a question title that starts with "Verification code" (trimmed, case-insensitive) instead of equality, and the no-code branch uses `console.error` while still returning without throwing (a throw would make Google retry). Staff page copy updated. See [incidents.md](incidents.md) #24 and [spec-051](spec-051-google-form-onboarding.md). Existing forms keep the old script until staff paste the new one.
