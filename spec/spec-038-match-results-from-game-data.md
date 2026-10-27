# spec-038: Match Results From Game Data (HenrikDev)

- **Spec ID:** spec-038
- **Title:** Fetch best-of-3 results and per-player stats from submitted Valorant match IDs
- **Status:** Implemented in the PR for [#290](https://github.com/EZ-Esports/website/issues/290); migration `0054` written, **not yet applied to production**
- **Date:** 2026-10-27
- **Scope:** `app/lib/match-results/` (port, adapter, schema, scoring), `app/lib/db/match-results.ts`, `app/lib/onboarding/match-result-actions.ts`, the portal `MatchesSection` / `MatchResultControls`, migration `0054_match_games_from_game_data.sql`.
- **Relationship to other work:** the interim path while the official-Riot work is on hold. [#248](https://github.com/EZ-Esports/website/issues/248) (Riot match ingestion) and [#247](https://github.com/EZ-Esports/website/issues/247) (Riot Sign-On) stay open and untouched; this is built behind a port so Riot's official API can replace it by writing one adapter.

## Context & Motivation

Results were typed by hand or reported in Discord ([#242](https://github.com/EZ-Esports/website/issues/242)). A manager now pastes the Valorant match IDs (or tracker.gg links) of a best-of-3 and the site fetches the real games, scores the series, checks the players against the two rosters and saves the result.

## Design Decisions

- **Data source.** `GET https://api.henrikdev.xyz/valorant/v4/match/{affinity}/{match_id}` (affinity `na`), key in the `Authorization` header from env var `VALORANTAPI`. Server-only: read in `match-results/server.ts`, passed to the adapter's constructor, never returned, logged or sent to the client. Unset key = adapter reports `misconfigured` and the UI says to ask an admin; manual result entry is unchanged and remains the fallback.
- **Port/adapter (same style as `GameIdentityPort`, spec-011).** `MatchDataPort.fetchMatch(id)` returns `{ ok, game }` or a typed failure (`not_found | rate_limited | unavailable | invalid_response | misconfigured`). `HenrikMatchAdapter` is the only file that knows the URL, header and status codes. The app only sees `NormalizedGame`.
- **Schema validation.** `henrik-schema.ts` parses the response with zod (promoted from a transitive to a direct dependency, `^4.6.7`). Only the fields we use are required; the rest (rounds, kills, economy, locations) is ignored. A drifting payload fails as `invalid_response` instead of producing bad numbers.
- **MVP is derived, not read.** The documented v4 response has no MVP field. We calculate, as tracker.gg presents them: **match MVP** = highest score on the winning team, **team MVP** = highest score on the losing team; ties break on kills and a full tie yields none. The UI says "calculated by EZ Esports". If a live response turns out to carry a real MVP field, swap the derivation inside `normalizeHenrikMatch` only.
- **ACS** is `score / rounds played` (rounded), computed at read time. K/D, headshot % likewise.
- **Input.** `parseMatchReferences` accepts bare UUIDs or `https://tracker.gg/valorant/match/<uuid>` (host exactly `tracker.gg` / `www.tracker.gg`), splits on whitespace/commas, rejects repeats and counts outside 2 to 3 **before any API call** (both in the browser and again on the server).
- **Scoring (`series.ts`, pure).** Games are ordered by start time, not paste order. Per game: queue must be `custom`, game completed with a winner. Each in-game side (Red/Blue) is attributed to the home or away roster when at least 3 of its players' Riot IDs are on that roster and it beats the other roster's count; the two sides must resolve to different rosters (so sides may swap between games). Players on neither roster (a stand-in) are tolerated and reported, not refused. The series needs two wins for one roster and no game after it was decided; a 1-1 split after two games asks for the deciding game.
- **Roster identity.** A roster's Riot IDs are `players.ign` plus verified `player_identities` rows with provider `riot`, lower-cased, coaches excluded. PUUIDs are not stored on our side (spec-011 note), so matching is by `Name#Tag`; a renamed account will fail validation until the roster is updated.
- **Never request a game twice.** Finished games are cached in `valorant_games` (+ `valorant_game_players`), keyed by the unique `riot_match_id`. `resolveSeries` reads the cache first and fetches only missing ids, storing each fetched game *before* validation, so a refused series never costs a second request. A game can be attached to only one league match (`match_games.game_id` unique, plus an up-front check) which is the duplicate rule; resubmitting to the same match is allowed.
- **Rate limit / outage.** `429` honours `Retry-After` / `X-RateLimit-Reset` (default 60 s, cap 1 h); 5xx and network errors count as unavailable. Either saves a `match_result_submissions` row (`pending`, the ids, `retry_after`, message; one open per match via a partial unique index) and the portal shows "Waiting on the match data service" with **Check again** and **Discard**. Retry is a user click only (no polling) and refuses to call before `retry_after`.
- **Saving.** `saveSeriesResult` runs in one transaction under a row lock: replaces `match_games`, writes `matches.home_score` / `away_score` (maps won) and `status = completed` (the columns manual reporting writes, so standings need nothing new), and closes the pending row. The action then calls `updateTag('matches' | 'rosters' | 'teams')` like the staff score action.
- **Who and when.** A manager of either school (for the match's game, in the match's own season; an inactive season is view-only) or a staff admin acting for one of the two schools. Only Valorant, only a match that has no result yet (`completed`/scored, cancelled and forfeit are refused; staff change those by hand).
- **PII.** The raw Henrik payload is **not** stored. Kept: map, times, rounds, and per-player name/tag/puuid/agent/tier and stat lines (the rostered students' public Riot IDs, which already live on rosters; opponents' stand-ins appear only if they played). Tables have RLS on with no policies (service role only).
- **Scoreboard.** Past-tab Result cell: **Scoreboard** opens a dialog with the series score and per-game tabs, two team tables (agent, ACS, K/D/A, K/D, HS%, damage, MVP badges). It is visible to the two schools' managers even while the season's outcomes are unpublished (spec-022 redaction still applies to the list's score column): they played and submitted these games. It is not on any public page.

## Invariants & Boundaries

- The key never leaves the server and is never in a message, log, test fixture or `.env.example` value (placeholder only).
- No test or CI path calls the live API: adapter tests inject a fake `fetch`, orchestration tests inject fake port/repository, action tests mock both.
- Do not call `fetchMatch` outside `resolveSeries` / the actions; every fetch must go through the cache.
- Games and the match's `home_score` / `away_score` must change together (one transaction); do not write scores for a fetched series elsewhere.

## Migration

`db/migrations/0054_match_games_from_game_data.sql` (hand-written like 0053, journal idx 54, no drizzle snapshot because snapshots stop at 0042): creates `valorant_games`, `valorant_game_players`, `match_games`, `match_result_submissions`, indexes, checks, RLS. Additive and `IF NOT EXISTS`; constraint names are under 63 characters. **Not applied to any database by this PR.** The owner applies it with `npm run db:migrate` (named host, fresh backup, per `CLAUDE.md`). Until applied, `getSchoolMatches` fails soft (the two new lookups log and return empty) and only the submit action would error.

## Verification

- Vitest with fixtures only: reference parsing, schema/normalization/MVP, adapter status mapping and key hygiene, series scoring (2-0, 2-1, 1-1, extra game, non-custom, strangers, same roster, stand-in, case, side swap, paste order), orchestration (cache hit, duplicates, 429/outage pending, store-before-validate), the server actions (input rejected before DB/API, authorization, refusals, success tags, pending save, retry wait) and the portal list wiring.
- Not verified: a real Henrik response (the schema follows the published docs; the live key was not used), the SQL against a real Postgres (no local database was used), the migration, and a browser check of the dialogs at desktop and phone width.

## Follow-ups

- Verify one real response and adjust the schema if Henrik differs (see MVP note); decide whether a published Henrik MVP should replace the derivation.
- Staff-side submit/inspect UI on `/admin/matches` (today staff use manual entry, or act through the portal for a school).
- Store PUUIDs on Riot identities to survive renames; reuse for [#247](https://github.com/EZ-Esports/website/issues/247)/[#248](https://github.com/EZ-Esports/website/issues/248).
- A public match page, gated by the season outcome publish rule (spec-022).
