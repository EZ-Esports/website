# spec-048: Roster size 10 players and 5 subs; a 5-starter eligibility minimum

- **Spec ID:** spec-048
- **Title:** Roster maximum raised to 10 players and 5 subs; tournament eligibility needs 5 starters and no substitute
- **Status:** Implemented on branch `feat/roster-max-10`, PR TBD. Not merged. No migration.
- **Date:** 2026-10-29
- **Scope:** `app/lib/onboarding/roster-limits.ts` (the two constants), `getRosterEligibility` Gate 1 in `app/lib/onboarding/portal-actions.ts`, the "(Min 5)" label in `RosterCard.tsx`, and the tests and comments that stated 7 and 2.
- **Supersedes:** the numbers in [spec-034](spec-034-roster-move.md) "Roster size limits" and the Gate 1 rule of [spec-011](spec-011-player-onboarding-and-manager-portal.md) (min 6 players, at least 1 sub).

## Context & Motivation

The owner wants a full roster to fit: up to 10 people on a roster, with up to 5 of them as substitutes. The tournament bar is lowered to match the league's reality: a team needs a bare minimum of 5 players, and substitutes are optional rather than required.

## New limits

| Rule | Before | Now |
| --- | --- | --- |
| Roster maximum (every role counts) | 7 players (`MAX_ROSTER_PLAYERS`) | 10 players |
| Substitute maximum | 2 (`MAX_ROSTER_SUBS`) | 5 |
| Tournament eligibility, roster size (Gate 1) | total >= 6, starters >= 5, subs >= 1 | starters >= 5 (so total >= 5); no substitute required |

Gate 1 now reads `totalPlayers >= 5 && starters.length >= 5`. Reasons: "Roster size must be at least 5 players (currently N)" and "Roster must have at least 5 starters (currently N)". The "at least 1 substitute" reason is gone.

## What did not change

- **Eligibility stays minimum-only.** `getRosterEligibility` still does not import `roster-limits.ts`; a test reads its source to prove it.
- **App-level caps only.** No database constraint. The caps still apply to adding (manager enroll, which is where an accepted invite is placed, staff add, moves) and to changing someone to sub, with the same messages and locks as before.
- **Existing rosters are not retroactive.** A roster above 10 players or 5 subs is left alone (it can still be edited, moved out of or emptied). Rosters that were legal under 7 and 2 stay legal.
- **Captain, sibling-roster and move rules** are unchanged.
- **Match results** ([spec-038](spec-038-match-results-from-game-data.md)) originally scored 5 players per side; spec-052 later removed the fixed team size (players need only be on the rosters).

## Open question

The owner's wording was "bare minimum 5 players". It was read as 5 starters with no substitute required, which is what the code does. If the owner meant 5 players including at least one sub, Gate 1 would need `subs.length >= 1` added back.

## Verification

Unit tests were updated to the new numbers and cover: the 10th player accepted and the 11th refused; the 5th sub accepted and the 6th refused; 5 starters with 0 subs passing Gate 1; 4 starters failing it. Full `npx vitest run` and `npx tsc --noEmit` were run on the branch.
