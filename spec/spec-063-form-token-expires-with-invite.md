# spec-063: Onboarding form token expires with its invite

- **Spec ID:** spec-063
- **Title:** The Google Form verification token lives as long as the invite it is bound to
- **Status:** Implemented on branch `worktree-agent-a6507e44ade1e662a`, unmerged. No migration.
- **Date:** 2026-11-13
- **Scope:** `app/lib/onboarding/google-form/token.ts`, `google-form-actions.ts`, `wizard/submission-pipeline.ts`, `OnboardingFormStep.tsx`, token and actions tests.
- **Builds on:** [spec-051](spec-051-google-form-onboarding.md).

## Problem

The token expired a fixed 6 hours after issue. A student submitting later had the response recorded by Google but rejected by the webhook (`token_expired`), and "Limit to 1 response" blocked resubmission. See incident 25.

## Change

- `signFormToken(input, now?, expiresAtSec?)`: `exp` is `expiresAtSec` when given; otherwise `now + FORM_TOKEN_TTL_SECONDS` (6 hours, the fallback for invites with no expiry). It throws if `exp <= now`, so a token never lacks a future expiry.
- `issueOnboardingFormLink` passes the invite's `expiresAt` (floored to whole seconds). An invite already expired at second resolution gets no link (same message as an invalid invite).
- `verifyFormToken` and `POST /api/google-form/complete` are unchanged, including the separate pending/unexpired invite check (409 `invite_expired`).
- Copy: the `onboarding_form_required` message and the wizard's expired notice no longer promise 6 hours.
- Tokens already issued keep their old `exp`; no migration.

## Operations

Students already caught by the old rule can be marked complete by a manual insert into `onboarding_form_completions` with `source = 'manual'`. The owner does this by hand; no admin override is built.
