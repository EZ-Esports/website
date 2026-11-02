# spec-052: Match result submit: three link fields, looser rules, tracker help and a fuller tutorial

- **Spec ID:** spec-052
- **Title:** One labeled input per game; no fixed team size; no scheduled-start window; Henrik custom-queue fix; tracker-link help; expanded portal tutorial
- **Status:** Implemented in PR [#325](https://github.com/EZ-Esports/website/pull/325) (branch `worktree-three-match-link-forms`), unmerged. A real Henrik response for a custom game was fetched and the queue fix verified against it; the submit dialog and tutorial have not been checked end to end in a browser.
- **Date:** 2026-11-01
- **Scope:** `MatchResultControls.tsx` (`SubmitDialog`), `TrackerLinkHelp.tsx`, `app/lib/match-results/` (`parse-match-ref.ts` `validateGameLinks`, `series.ts`, `resolve-series.ts`, `henrik-schema.ts`, `tracker-link-help.ts`), `onboarding/match-result-actions.ts`, `portal/tour/steps.ts`, `PortalHeader.tsx`, `MatchesSection.tsx`, and their tests.
- **Amends:** the Input, Roster rule and Scheduled-start bullets of [spec-038](spec-038-match-results-from-game-data.md), and the match-results note in [spec-048](spec-048-roster-size-10-and-five-subs.md). The 2-game minimum and 3-game maximum are unchanged.

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

## Roster rule change: no fixed team size

The "exactly 5 players per side" check in `attributeGame` (`series.ts`, `PLAYERS_PER_SIDE`) was removed. A game is now accepted when every player on each side is on one school's roster (starters and subs), whatever the head-count. A side with no players is still refused. Ringer, mixed-school, same-school and both-rosters refusals are unchanged. Tests in `series.test.ts` now assert 1v1, 2v2, 4v5 and 6v5 are accepted when rostered, and that a short-handed side with a non-roster player is still refused.

## Scheduled-start window removed

The "game started more than 1 hour before the scheduled start" refusal (`earlyStartError`, `EARLY_START_LEEWAY_MS`, the `scheduledAt` argument of `scoreSeries`/`resolveSeries`) was removed. Games are no longer compared against `matches.scheduled_at`. The duplicate rule (a game attaches to one match) and the roster checks remain the only guards against reusing an unrelated game.

## Tracker-link help and tutorial expansion

- The Submit result dialog has a "How do I get a match link?" click-to-open popover (`TrackerLinkHelp`, React Aria `Popover`, so it works on touch and keyboard). The four steps (open your tracker.gg Valorant page, click Customs, click the three dots on the match, then Open in new tab and copy the URL or Share and copy the link) live in `app/lib/match-results/tracker-link-help.ts` and feed both the popover and the tutorial.
- The portal tutorial (`portal/tour/steps.ts`) now covers the whole manager portal: season and view-only/locked status, ET times, the invite form and what the student does, invite history actions, approvals, roster creation, enrolling, roles/move/remove, the 5-point eligibility gate, the three match tabs (Upcoming, Needs result, Past), reschedules and the one-per-season allowance, and a new "Submit match results" section (submit, getting the link, one link per game, validity rules, timing/limits/pending, scoreboard). New anchors: `portal-header` and `matches-list`. Several steps share an existing anchor so the empty-portal anchors test still holds.
- Tests: every declared anchor is used by a step, and the tour step for getting a link contains exactly the shared steps.

## Henrik custom-queue fix

A live lookup of a real custom game showed Henrik sends `queue.id` as an empty string with `queue.name` "Custom Game", while the adapter required `queueId === 'custom'`, so every real custom game would have been refused as "not a custom game". `normalizeHenrikMatch` now maps an empty id with the name "Custom Game" to `custom` (`queueIdOf`); an empty id with any other name stays empty and is refused. This was the first check of spec-038 against a real response: the schema otherwise parsed (an 8-player game, 4 per side). Henrik also returns an `mvp` field in `metadata`, which the derived-MVP decision in spec-038 does not use yet.

## Operational notes

- Henrik returns "Match not found" for older matches even when tracker.gg still lists them, so a manager testing with an old game will see the not-found refusal.
- Not done: the minimum remains 2 games; no database change or migration; `spec/product.md`, `architecture.md` and `open-threads.md` were updated for the new behaviour.
