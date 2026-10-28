# spec-040: Offensive Language Filter in Onboarding

- **Spec ID:** spec-040
- **Title:** Block profanity and slurs in typed student and manager onboarding fields
- **Status:** Implemented on branch `feat/onboarding-profanity-filter`, not yet merged. No migration.
- **PR / Commit:** pending (branch `feat/onboarding-profanity-filter`)
- **Date:** 2026-10-28
- **Issue:** [#291](https://github.com/EZ-Esports/website/issues/291)
- **Scope:** the player and school manager join wizard, the server submission pipeline, and the rules page. Builds on [spec-011](spec-011-player-onboarding-and-manager-portal.md) and [spec-029](spec-029-onboarding-consent-form.md).

## Rule

- The rules page (`/rules`, section 3.4) says offensive names and submitted information are not allowed, including profanity and slurs in English and other common languages. It says staff also review submissions.
- The Code of Conduct checkbox in `DemographicsStep` states the same rule and links to `/rules`. It is still required on both paths.

## Filter (`app/lib/onboarding/profanity.ts`)

- Pure and dependency-free, so the client and server share it. Best-effort term lists grouped by language (English, Spanish, French, German, Portuguese, Italian, Dutch, Russian, Polish, Turkish, romanized Hindi/Urdu). Coverage is uneven and is not a complete list.
- Normalization: NFKD and diacritic stripping, leetspeak substitutions, zero-width character removal, Cyrillic lookalike folding, separators that split a word (`f.u.c.k`, `nigg-a`), runs of 1-2 letter tokens joined across spaces (`f u c k`), and repeated letters collapsed for longer terms.
- Whole-word matching by default. Substring matching only for a short list of long, unambiguous terms. An allowlist covers known collisions (for example Dickson, Hancock, Cockburn, Scunthorpe, assess, class, cum laude).
- Three exemption kinds, by field:
  - `name` (legal first and last name): also passes `dick`, `dyke`, `coon`, and the ambiguous foreign insults below.
  - `handle` (Riot ID): passes the ambiguous foreign insults. English slurs are still flagged.
  - `text` (feedback and other free text): nothing is exempted.
- Ambiguous foreign words (`tering`, `kut`, `hoer`, `cipa`, `suka`, `pust`, `lul`, `puta`, `bosta`, `gandu`, `ibne`, `kahpe`) are blocked in free text only, because they are also real names or ordinary words in their languages.
- The result carries the field, never the matched word, so messages never echo it.

## Enforcement

- **Server:** `validateSubmissionInputs` in `app/lib/onboarding/wizard/submission-pipeline.ts` checks every typed free-text field: legal names, Riot ID, country of birth, primary language at home, survey feedback, and the consent fields. Guardian fields are checked only when the consent is for a minor, using the same age rule as `validateConsent`. The check throws `OnboardingRejection('offensive_content', ..., { field })`, which `submitPlayerOnboarding` returns as a result. Player and manager paths both pass through it.
- **Non-string values** in a screened field (array, object, number) throw a plain `Error('Invalid onboarding submission.')`. A student cannot cause this from the form, so it is not a student-fixable rejection.
- **Client:** `useWizardDraft.ts` runs the same checks in `validateStep1`, `3`, `4` and `5` (guardian fields only when `isMinor`), so the error appears before submit.
- **Routing:** `stepForRejection(code, field)` in `types.ts` sends the student to the step holding the offending field (1 names, 3 Riot ID, 4 country/language/feedback, 5 consent).

## Known limits

- Masked spellings (`f**k`) and repeated letters in short terms (`asss`) are not caught.
- Languages outside the list (for example Arabic, Japanese, Korean, Chinese, Vietnamese) are not screened.
- A deliberately typed foreign insult in a name or Riot ID passes. Staff review is the backstop.
- The Code of Conduct and terms checks still throw plain `Error`s that production masks. This is a pre-existing follow-up, not changed here.
- Accuracy was checked only against the unit tests, not real submissions.
