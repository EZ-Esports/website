# spec-051: Google Form completion step in onboarding; the demographics survey is removed

- **Spec ID:** spec-051
- **Title:** Replace the in-app demographics survey with a staff-configured Google Form whose completion the server verifies
- **Status:** Implemented on branch `feat/322-google-form-onboarding`, issue [#322](https://github.com/EZ-Esports/website/issues/322). Not pushed, not merged. **Migration `0057` is written and not applied.** Never exercised against a real Google Form or Apps Script.
- **Date:** 2026-10-31
- **Scope:** `app/lib/onboarding/google-form/{settings,token,config,apps-script}.ts`, `app/lib/onboarding/google-form-actions.ts`, `app/lib/db/onboarding-form.ts`, `app/api/google-form/complete/route.ts`, `app/(admin)/admin/onboarding-form/`, the join wizard (`components/steps/{BirthDateRulesStep,OnboardingFormStep}.tsx`, stepper, `useWizardDraft`, `types.ts`, `page.tsx`), `submission-pipeline.ts`, `app/lib/db/content.ts`, `app/lib/roles.ts`, `app/lib/db/roster-removal.ts`, `db/purge-onboarding-test-data.ts`, `db/migrations/0057_onboarding_form_completions.sql`.
- **Supersedes:** the demographics parts of [spec-011](spec-011-player-onboarding-and-manager-portal.md) (survey step, `student_demographics`, `/admin/demographics`, `VIEW_STUDENT_DEMOGRAPHICS`).

## Why

The survey collected race, ethnicity, lunch status and similar into a gated vault that staff rarely used. Staff would rather run it as a Google Form they can edit and read in a sheet. Google Forms cannot redirect back to us on submit (no OAuth-style callback), so "this person finished" has to be reported by the form itself.

## What was removed

`/admin/demographics`, `DemographicsExplorer`, `DemographicsStep`, `app/lib/db/demographics.ts`, the `student_demographics` table, every survey field in the wizard, draft, submission type, pipeline step and tests, the `demographics` count in roster-removal results, and its row in the purge script. The survey keys are still listed in `NEVER_DRAFTED_KEYS` so an old saved draft drops them instead of reading them back.

- **Date of birth stays in the wizard** (step 4, now "Date of Birth & Rules" with the code-of-conduct checkbox) because the guardian authorization needs the age. It is validated on the server and **not stored** (it was in the dropped table). Owner accepted this.
- **Permission bit 12 is retired, not reused.** `Permissions.VIEW_STUDENT_DEMOGRAPHICS` is gone; `RETIRED_PERMISSION_BITS` reserves bit 12 and `canGrantPermissions` ignores it on the target (see Pitfalls). New permission bits start at 13.
- The old `student_demographics` rows are disposable (owner decision). Migration `0057` drops the table anyway, so back it up first if there is any doubt.

## The flow

1. Staff open `/admin/onboarding-form` (`Permissions.MANAGE_LEAGUE`), paste the form link and the entry id of the "Verification code" question, and save. Settings live in two `page_content` rows (`onboarding_form_url`, `onboarding_form_entry_id`); saving calls `updateTag('page-content')`.
2. The config is **enabled only if** link, entry id and `GOOGLE_FORM_WEBHOOK_SECRET` (16+ chars) are all present and valid. Stored values are re-validated on every read. Anything else means the wizard has no form step and nothing is enforced.
3. When enabled the wizard has a sixth step. `issueOnboardingFormLink(token)` (server action) returns the form link with `usp=pp_url&entry.<id>=<token>`. The token is HMAC-signed, bound to the invite (kind and id), and expires in 6 hours. Each press of "Open the form" issues a new one.
4. The form's Apps Script `onFormSubmit` trigger reads the "Verification code" answer and `POST`s it to `/api/google-form/complete` with `Authorization: Bearer <webhook key>`.
5. The route: secret configured, bearer valid, body shape, token signature and expiry, invite exists and is `pending` and unexpired, then inserts into `onboarding_form_completions` with `ON CONFLICT DO NOTHING` (idempotent). Responses: 200 `{ok, recorded}`; 503 secret missing; 401 bad key; 429 too many bad keys (with `Retry-After`); 400 `invalid_token` / `token_expired` / bad body; 413; 404 unknown invite; 409 invite not pending or expired; 500 database error.
6. The wizard polls `getOnboardingFormState(token)` (every 4 s, 15 s after 10 minutes, paused in a background tab, re-checked on focus) until the server reports a completion. The browser can never mark the step done on its own.
7. `processOnboardingSubmission` re-checks `hasFormCompletion` on the server for players **and** managers and rejects with `onboarding_form_required` (returned, not thrown) when the form is enabled and no completion exists. The wizard sends the person back to step 6. On success the completion row's `member_id` is set to the new member.

## Storage

`onboarding_form_completions(id, invite_kind, invite_id, member_id?, source, completed_at)`: unique on `(invite_kind, invite_id)`, `invite_kind` in (`player`, `manager`), `source` in (`google_form`, `manual`), `member_id` FK to `members` `ON DELETE CASCADE`, RLS enabled. Ids and a timestamp only; **no form answers are ever stored** (they stay in the Google response sheet). `source = 'manual'` is reserved for a future staff override and nothing writes it.

## Keys and secrets

`GOOGLE_FORM_WEBHOOK_SECRET` is only a root. Two keys are derived with domain-separation labels: a token key (signs verification tokens, never leaves the server) and a webhook key (hex, 64 chars) that is the Apps Script's bearer credential. The staff page shows the **webhook key**, not the env var, and the Apps Script property is named `WEBHOOK_KEY`. A leaked script property can report completions for tokens the server issued but cannot mint a token for another invite. This deviates from the issue text ("`WEBHOOK_SECRET` equal to the env var") on purpose (pitfall 6). Rotating the env var invalidates the key and every outstanding code.

## Pitfalls from the issue, and how each is handled

| # | Pitfall | Handling |
| --- | --- | --- |
| 1 | 429 permanently dropped a completion; limiter keyed on Google's shared egress address and charged before auth | The Apps Script retries 408, 429 and 5xx and network errors (up to 5 attempts, honouring `Retry-After`, capped at 30 s) and throws on everything else. The route authenticates first and charges the limiter (`gform-auth-fail:<ip>`, 10 per 10 minutes) **only for a failed bearer**; a valid bearer is never counted or blocked. |
| 2 | `MANAGE_CONTENT` could overwrite the form settings through the generic editor | `savePageContentWithHistory` and `restorePageContentFromHistory` refuse `ONBOARDING_FORM_KEYS` (checking the target row and the history entry); the `/admin/content` page also hides those rows and their history. |
| 3 | Roles carrying retired bit 12 became un-assignable by non-owners | `canGrantPermissions` masks `RETIRED_PERMISSION_BITS` off the target. The migration does not rewrite role bitmasks. The role editor drops the bit on the next save of that role (it is outside the editable bits). |
| 4 | Expired tokens: a 400 the script does not retry, and the student was not told | Still a non-retryable 400 with code `token_expired` (a retry cannot succeed). The wizard step shows an amber notice once the link's expiry passes ("open the form again"), a hint after 90 s without a result, an "Open the form again" button that issues a fresh code, and the `onboarding_form_required` message mentions the 6-hour limit. |
| 5 | `/edit` and `forms.gle` links accepted, which do not honour prefill | `normalizeGoogleFormUrl` requires `https`, host `docs.google.com`, and `/forms/d/e/<id>[/viewform]` or `/forms/d/<id>/viewform` (optional `/u/<n>`), rejects userinfo and ports, and stores the canonical `/viewform` URL without query. Specific messages for `forms.gle` and editor links. |
| 6 | One secret was both bearer and HMAC root | See Keys and secrets. |
| 7 | Manager completion rows not removed with roster removal or the purge script | The FK cascade handles any member delete. `deleteMember` (roster removal) also deletes by member and by the member's player or manager invites, and counts them as `formCompletions`. `deletePlayerInvite` deletes the invite's completion (best effort). The purge script lists `onboarding_form_completions` in `DELETE_ORDER` and deletes every completion not tied to a protected invite or staff member, including memberless ones. |
| 8 | Setup steps did not describe the verification question | Setup step 2 on the staff page gives the exact description to put on the question ("Leave this code as is..."). The wizard step tells students the same. |
| 9 | Manual override not built | Still not built. `source = 'manual'` is allowed by the table's check constraint and nothing writes it. |

## Staff page

`/admin/onboarding-form` sits under League Operations, replacing Student Demographics in the nav. It shows a status chip (Active / Off: server secret missing / Off: saved settings are incomplete / Off), a missing-secret warning, the completion count (hidden if the table is absent), the settings form, the seven setup steps, the Apps Script (pointing at the current origin) and the masked, copyable webhook key.

## Deploy order and cautions

1. Set `GOOGLE_FORM_WEBHOOK_SECRET` in Vercel (16+ random characters) before anyone configures the form.
2. **Deploy the code first.** Old code writes `student_demographics` on every submission, so applying `0057` before the new code is live breaks onboarding.
3. Then apply migration `0057` (`db:migrate` needs `PG_DUMP` and `SEED_ALLOW_REMOTE` for production; see `CLAUDE.md`). It creates `onboarding_form_completions` and **drops `student_demographics`** (PII, disposable per the owner; back it up if unsure). Both steps must precede configuring the form.
4. Between steps 2 and 3 nothing reads the new table unless the form is configured, and the invite-delete cleanup tolerates its absence. The purge script requires `0057` applied.
5. Staff then configure the form on the new page. Pending invites created before then become subject to the requirement from that moment.
6. No cache purge is needed beyond what saving settings does; the page-content tag is invalidated on save.

## Known limits

- **Not tested against a real Google Form or Apps Script.** The script text is only checked for syntax and for the retry and auth rules it must contain. First real run: add the trigger, submit a test response from a pending invite's prefilled link, confirm the completion count goes up.
- The rate limiter is the existing in-process one: counters reset on cold starts and are per instance.
- A student can submit the form twice or share a prefilled link with a friend; the code binds the completion to the invite, not to a person, and holds no answers. Anyone holding the link can complete on that invite's behalf. Accepted: this is a completion check, not an identity check.
- Changing the form (new copy, new owner, re-added question) needs the script, key, trigger, link and entry id redone (see the staff page).
- Between a student submitting and the poll seeing it there is a delay of a few seconds (Google trigger latency plus the 4 s poll).

## Verification

`npx tsc --noEmit`, `npm run lint` and the full `npx vitest run` pass in the worktree. New tests cover URL normalization, token sign/verify/expiry/tamper/kind, derived keys, config enablement, Apps Script content, the webhook route (config, auth, failed-auth limiter, valid bearer never limited, token/invite checks, idempotency), the wizard server actions, the staff settings action, the pipeline gate for players and managers, the page-content write guards, retired-bit masking, the wizard step (polling, expiry notice, fallback link), and the real SQL of migration `0057`, the completion helpers and roster-removal/purge cleanup on PGlite. Not run: a dev server, a browser, any real database, a real Google Form.
