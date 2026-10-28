# spec-043: Generate season (staff Matches page)

- **Status:** Implemented on branch `feat/generate-season`; no migration; not run against any database.
- **Date:** 2026-10-28
- **Scope:** `app/lib/season-schedule.ts`, `app/lib/season-generation.ts`, `app/(admin)/admin/matches/generate-season-actions.ts`, `app/components/admin/GenerateSeasonDialog.tsx`, `AdminMatchExplorer.tsx`, `matches/page.tsx`

## Context

Building a season by hand meant creating a team per school, a roster per team, and then scheduling every match one at a time. The league rule is that every school plays exactly 7 matches against 7 different opponents.

## Design decisions

- **Math.** A 7-regular simple graph on n schools exists only for even n >= 8. The schedule is the first 7 rounds of the circle-method round robin: each round is a perfect matching (every school plays exactly once), rounds never repeat a pairing, so there are no rematches or self-matches and the 7 rounds are the 7 weeks. Errors are explicit: fewer than 8 schools, or an odd count ("add one school or remove one"). Pure and deterministic: ids are sorted, shuffled with a seeded PRNG (seed = season id) and the home side goes to the school with fewer home games so far. Preview and confirm therefore compute the same schedule.
- **Season choice.** Staff pick a team-model game, then one of its existing seasons (seasons are still created in League Setup; no season creation here), a division (Varsity, or JV where the game has it) and the participating schools (active, not deleted). Tournament games are excluded: they have no round robin.
- **Matches are roster-to-roster.** `matches` reference rosters, not teams. For the chosen division each school needs a roster, so Generate creates a missing team (`teams` unique on school+game+season) and a missing roster named `Varsity`/`JV` (stored `A`/`B` via `storedDivision`). An existing team or roster in that division is reused, never duplicated.
- **Dates.** Staff enter the week 1 date; week k is that date plus 7(k-1) days at 7:00 PM Eastern (the same slot reschedules use, `PROPOSED_START_TIME_ET`). The wall time is resolved per date through `parseEastern` (spec-004), so the schedule keeps 7 PM local across the November DST change. All matches in a week share one kickoff.
- **Preview then commit.** `previewGenerateSeason` is a dry run (teams and rosters to create, 7 weeks of pairings). `commitGenerateSeason` re-reads everything inside a transaction, locks the season row (`SELECT ... FOR UPDATE`), re-runs the "season has no matches" check, verifies the preview fingerprint (hash of start date, division and pairings), and inserts teams, rosters and matches together. Any failure rolls back everything.
- **Double-generate protection.** Refused when the season has any match at all (any division, any status), checked in preview and again under the lock, so two staff confirming at once serialize and the second is refused. Adding the JV schedule after Varsity therefore needs matches removed first; see open threads.
- **Existing teams and rosters are never an error.** Per school: (a) a team with a roster in the chosen division is reused untouched (with several, the first by name, then id, plays and the rest are left alone); (b) a team with no roster in that division gets only the roster; (c) no team gets team and roster; (d) if the division name (`Varsity`/`JV`) is already taken on that team by a roster stored under another division, the new roster is named `Varsity 2`, `Varsity 3`, ... so the `(team, name)` unique index is not hit. The preview lists schools left unchanged, new teams and new rosters. A unique-index violation (pg 23505) from a concurrent edit during the write is still mapped to a readable "nothing was saved, preview again" message.
- **Known gap: single-match writes do not take the season lock.** `createMatch` (and delete) do not lock the season row, so a match scheduled by hand in the instant between Generate's check and insert is not seen. The window is one transaction; createMatch was deliberately left unchanged.
- **Dialog behaviour.** A request counter ref discards a preview that resolves after any edit, cancel or reopen; inputs are disabled while a preview builds; cancel/close resets all state; the preview sits in a persistent `role="status"` live region; Select all/Clear/school rows are at least 44px tall.
- **Auth and validation.** Both actions call `requirePermission(Permissions.MANAGE_MATCHES)` first, like the sibling match actions, and validate input with zod (uuids, Varsity/JV, real YYYY-MM-DD, max 200 schools). Cache tags `matches`, `rosters`, `teams` are updated plus `revalidatePath('/admin/matches')` and `/`.
- **UI.** "Generate season" secondary button in the Matches header opens a React Aria modal (`Overlay/Modal/Dialog`); any edit clears a shown preview; the final Generate uses `ConfirmActionDialog` (spec-037) with in-dialog error.

## Tests

`app/lib/__tests__/season-schedule.test.ts` (degree 7, no duplicate opponents, no self-play, one match per school per round for n = 8..30, determinism, home balance, odd/too-few/duplicate errors, DST-stable kickoffs, plan idempotency, fingerprint) and `app/(admin)/admin/matches/__tests__/generate-season-actions.test.ts` (permission gate, input validation, preview writes nothing, single transaction insert of teams/rosters/28 matches, reuse of existing teams, double-generate refusal, stale fingerprint, cases (a) to (d) of existing teams and rosters, 23505 mapping) and `app/components/admin/__tests__/GenerateSeasonDialog.test.tsx` (inputs locked while previewing, stale preview ignored after cancel/reopen, status region).

## Not verified

Not exercised in a browser or against a database (no sign-in, production `.env`); the `FOR UPDATE` lock and bulk inserts run only against mocks.
