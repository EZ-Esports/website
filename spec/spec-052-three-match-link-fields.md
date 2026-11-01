# spec-052: Three match link fields in the Submit result dialog

- **Spec ID:** spec-052
- **Title:** One labeled input per game instead of a single paste textarea
- **Status:** Implemented on branch `worktree-three-match-link-forms`, unmerged.
- **Date:** 2026-11-01
- **Scope:** `app/(portal)/portal/components/MatchResultControls.tsx` (`SubmitDialog`), `app/lib/match-results/parse-match-ref.ts` (`validateGameLinks`), `app/lib/match-results/__tests__/parse-match-ref.test.ts`.
- **Amends:** the Input bullet of [spec-038](spec-038-match-results-from-game-data.md).

## Why

One textarea ("one per game") left managers guessing how many entries were wanted and which line an error referred to. Three labeled fields make the best-of-3 shape obvious.

## Behavior

- Fields: "Game 1 link" and "Game 2 link" (required), "Game 3 link (only if a deciding game was played)" (optional). Each takes one bare UUID or tracker.gg link.
- `validateGameLinks(values)` returns a per-field error (required, more than one value, not a match reference, repeats an earlier field) plus the joined `input`. Errors render under the field, linked with `aria-describedby` and `aria-invalid`. Editing a field clears its error. The form uses `noValidate` so the inline errors, not native bubbles, are shown.
- The non-empty values are joined with `\n` and sent as the existing `input` to `submitMatchResult`. The server action and `parseMatchReferences` are unchanged and still enforce 2 to 3 games and no duplicates, so the rule holds even if the client is bypassed. Server-side problems still show in the dialog's `ErrorList`.
- Pending state ("Checking…"), reset of fields, errors and messages on close or success, and 44px mobile targets on inputs are kept.
- No migration.

## Tests

`validateGameLinks` cases in `parse-match-ref.test.ts`: two and three games, required fields, malformed and multi-value fields, duplicates across id and link forms. The component has no render tests in this repo.
