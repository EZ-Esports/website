# spec-033 — 2025-26 Valorant A-Team Playoffs

**Spec ID:** spec-033
**Date:** 2026-10-25
**Status:** In Review
**PR / Commit:** pending
**Scope:** `sharepoint/manual/valorant-2025-26-a-playoffs.json`, `sharepoint/normalize_gold.py`, `db/seed-gold.ts`, `matches.counts_for_standings` (migration `0054`), `roster_standings`, the regular-season form strip.

---

## Context & Motivation

The 2025-26 Valorant A-team playoff bracket was reported in Discord, not on the regular-season sheet. The sheet processor skips cells whose text contains "playoff" or "final", so those seven series never reach silver. They are still league matches: Brooklyn Technical High School beat Bayside High School 3-1 in the final.

This change records the bracket in the archive. It does not load it. Production is the only database, and ingest stays a separate explicit step.

## Design Decisions

The supplement is JSON under `sharepoint/manual/`, not a CSV. `sharepoint/**/*.csv` is gitignored because the sheet dumps carry student emails and Discord handles. These rows are match results: school, series score, map score, and the match MVP.

`normalize_gold.py` appends the rows after the sheet matches. Sheet rows stay first so a playoff cannot renumber an existing `source_key`. Each row is a Varsity vs Varsity match in season `2025-26`, game `valorant`.

The Discord posts name a winner and a seed, not a home team. The higher seed is home, so the series score reads winner-first. In this bracket the higher seed won every series.

| Round | Report time (ET) | Home | Away | Series | Status |
|---|---|---|---|---|---|
| Quarterfinal | 2026-04-04 7:41 PM, placeholder | Stuyvesant (3) | Tottenville (6) | 2-0 | completed |
| Quarterfinal | 2026-04-04 7:42 PM | Brooklyn Technical (1) | Leon M. Goldstein (8) | 2-0 | forfeit |
| Quarterfinal | 2026-04-04 9:42 PM | Bayside (2) | Midwood (7) | 2-0 | completed |
| Quarterfinal | 2026-04-07 10:35 AM | Bronx Science (4) | Staten Island Tech (5) | 2-0 | forfeit |
| Semifinal | 2026-04-11 11:03 PM | Bayside (2) | Stuyvesant (3) | 2-0 | completed |
| Semifinal | 2026-04-11 11:15 PM | Brooklyn Technical (1) | Bronx Science (4) | 2-1 | completed |
| Final | 2026-04-18 4:43 PM | Brooklyn Technical (1) | Bayside (2) | 3-1 | completed |

Times are the Discord report times, not verified starts. The Stuyvesant quarterfinal's post had no timestamp in the export. Its kickoff is `2026-04-04 19:41:00`, one minute before the next report and off the sheet's `19:00:00` default, so it cannot collide with a regular-season source key that uses that default. Map lines and MVPs are in the JSON notes. The two forfeits are 2-0, the score the 2021-22 Valorant A-team archive used when a side forfeited a best-of-three. The posts themselves only say the lower seed forfeited.

School slugs are the ones `normalize_gold.py` already writes (`slugify` of the canonical name): Brooklyn Tech is Brooklyn Technical High School, Goldstein is Leon M. Goldstein High School, Bronx Science is Bronx High School of Science, Staten Island Tech is Staten Island Technical High School.

`matches.counts_for_standings` (migration `0054`, default true) keeps a playoff on the schedule and out of the regular-season table. The number is `0054` because league main already has `0046` through `0053`, and `0053` is applied in production. `roster_standings` and the hub form strip both require it. Derived gold standings skip rows that set it false. Recent results are unfiltered, so the final can still appear in League Pulse once the rows exist. The admin match form does not expose the flag; a fixture created there keeps the default and counts.

## Invariants & Boundaries

- This PR does not run `db:migrate` and does not run `db:ingest:gold`. Do not apply `0054` until the bracket is approved. After that: merge, then migrate, then ingest.
- After this code is what `db:ingest:gold` executes, the loader reads and writes `counts_for_standings`. An ingest against a database that has not applied `0054` fails at the match step. Games, schools, and the earlier upserts are idempotent; the failure is still a reason to migrate first.
- Load order, after approval: merge, apply `0054`, rebuild gold (`python3 normalize_gold.py` from `sharepoint/`), `npm run db:ingest:gold -- --dry-run`, then ingest. The dry-run has to show seven match inserts and no regular-season score edits before any write.
- Rebuilding gold is not a database write. `gold_data/` stays gitignored.
- A blank `counts_for_standings` cell still counts. Only an explicit `false` opts out. The manual file is rejected if any row forgets that.
- Playoff reporter names and graduation years from the Discord paste are not stored. The MVP is the player named in the post.

## Verification

- `npx vitest run sharepoint/__tests__/valorant-2025-26-a-playoffs.test.ts app/lib/db/__tests__/queries-hub.test.ts`
- `python3 -m pytest sharepoint/tests/test_manual_playoffs.py`
- Confirm no `db:migrate` and no `db:ingest:gold` was run for this change.
