# spec-010 — Decoupled Tournament Competition Model & Forward-Facing Brackets

**Spec ID:** `spec-010`
**Date:** 2026-10-01
**Status:** Completed
**Scope:** Architectural competition decoupling across games (`competitionModel: 'team' | 'tournament'`), dedicated database schema migration for tournaments (`tournaments` and `tournament_matches`), forward-facing tournament bracket UI powered by `bracketry`, and stage/group visualizer.

---

## Context & Motivation

Historically, the competition architecture assumed all titles followed traditional round-robin team leagues (e.g. Valorant, League of Legends) featuring multi-week calendar fixtures and split Varsity / Junior Varsity divisions.

However, titles like **TETR.IO** and **Teamfight Tactics** operate on tournament-style competition models (such as Challonge double-elimination brackets, group stages, and single-elimination knockouts). Forcing these games into the league schedule layout led to severe UX and architectural issues:
1. **Misleading Calendar**: Single-day weekend tournaments crammed all 20+ matches into one calendar square with an overflow badge, leaving 29 days blank.
2. **Missing Progression Context**: Match cards flattened chronological results without indicating progression (e.g. Winners Pilot Round vs Quarterfinals vs Grand Finals).
3. **Loss of Player Identity**: 1v1 / 2v2 participant IGNs recorded in match notes were obscured by top-level school-vs-school labels.
4. **Hardcoded Varsity/JV Division Tabs**: The schedule page assumed every game fields Varsity/JV squads, rendering empty tabs for individual games with undivided fields.
5. **Technical Debt of Overloaded Tables**: Overloading the league `matches` table or parsing free-text notes for tournament bracket metadata introduces schema bloat, nullable pollution, and untyped state.

---

## Design Decisions (Option A: Relational Decoupling)

### 1. Dedicated Relational Schema (`0040_workable_captain_stacy.sql`)
Instead of adding tournament columns or category enums to the existing `matches` table, the competition models are completely separated into dedicated relational tables under the game entity:

#### `tournaments`
- **`id`** (`uuid`, primary key)
- **`game_id`** (`uuid`, references `games.id`)
- **`season_id`** (`uuid`, references `seasons.id`)
- **`name`** (`text`, e.g. `'TETR.IO Season 2025-26 Championship'`)
- **`slug`** (`text`, unique per season)
- **`format`** (`enum`: `'single_elimination'`, `'double_elimination'`, `'round_robin'`, `'swiss'`, `'group_stage'`, `'custom'`)
- **`status`** (`enum`: `'upcoming'`, `'ongoing'`, `'completed'`)
- **`start_date`** / **`end_date`** (`timestamp with time zone`)
- **`notes`** (`text`)

#### `tournament_matches`
- **`id`** (`uuid`, primary key)
- **`tournament_id`** (`uuid`, references `tournaments.id` on delete cascade)
- **`stage`** (`text`, indexed): `'winners' | 'losers' | 'grand_finals' | 'knockout' | 'group' | 'other'`
- **`round_name`** (`text`): e.g. `'Winners Round 1'`, `'Quarterfinals'`, `'Grand Finals'`
- **`round_order`** (`integer`): 1-based order of the round progression within the stage
- **`match_order`** (`integer`): 1-based order of the match within the round
- **`bracket_group`** (`text`, optional): e.g. `'Group A'`, `'Legends'`
- **`scheduled_at`** (`timestamp with time zone`)
- **`status`** (`enum`: `'scheduled'`, `'in_progress'`, `'completed'`, `'forfeited'`, `'cancelled'`)
- **`home_player_title`** / **`away_player_title`** (`text`): Player IGN
- **`home_school_id`** / **`away_school_id`** (`uuid`, references `schools.id`)
- **`home_score`** / **`away_score`** (`integer`)
- **`winner_side`** (`enum`: `'home'`, `'away'`, `'draw'`)
- **`notes`** (`text`)
- **`source_key`** (`text`, unique index)

### 2. Pre-Migration Database Snapshot & Automated Backfill
- A full 1021 KB PostgreSQL snapshot backup (`db/backups/gold-seed-2026-10-01T06-34-52-120Z.sql`) was verified prior to executing migration `0040_workable_captain_stacy.sql`.
- Automated backfill script migrated:
  - 4 tournaments into `tournaments` corresponding to TETR.IO seasons.
  - 53 historical TETR.IO matches into `tournament_matches` with structured stage, round, orders, participant IGNs, and school relationships.
  - Deleted all 53 non-league matches from the `matches` table, leaving `matches` 100% clean for team leagues.

### 3. Data Access Layer (DAL)
- **`app/lib/db/tournaments.ts`**: Provides `getGameTournaments(gameSlug)` and `getTournamentMatches(tournamentId)`.
- **`app/lib/db/matches.ts`**: Updated `getCachedRecentResults` to union completed league matches with completed tournament matches so the homepage League Pulse displays all game outcomes seamlessly.

### 4. Game Entity Decoupling (`competitionModel`)
Added `competitionModel: 'team' | 'tournament'` to `GameConfig` in `app/types/index.ts` and `GAMES` in `app/lib/constants.ts`:
- **`team` games** (Valorant, League of Legends):
  - Retain `/schedule` route with calendar month grid and Varsity / Junior Varsity filters.
  - Subheader nav displays **"Schedule"** and **"Teams & Rosters"**.
- **`tournament` games** (TETR.IO, Teamfight Tactics):
  - Primary canonical competition route is **`/[game]/bracket`**.
  - Direct access to `/[game]/schedule` cleanly returns `notFound()`.
  - Subheader nav displays **"Bracket"** and **"Participants & Rosters"**.

### 5. Tournament Bracket Framework (`bracketry`)
Instead of maintaining a custom DOM tree renderer, tournament brackets are visualized using **`bracketry`**:
- **Zero-Dependency & React 19 Compatible**: Pure JavaScript/SVG bracket renderer with 0 runtime dependencies (12kB gzipped), avoiding React 19 peer dependency conflicts.
- **Automatic Layout & SVG Connectors**: Computes tree hierarchy, round spacing, responsive navigation, and SVG bezier connecting lines.
- **Custom Player Node Markup**: Utilizes `getPlayerTitleHTML` to render the user-specified node hierarchy:
  - Primary line: Player IGN (bold text).
  - Secondary line: School / team name (smaller muted font).
- **Match Interactivity**: Clicking a match invokes `onMatchClick`, opening `BracketMatchModal` for deep details (timestamps, full school names, notes, scores).

---

## Verification
- Vitest suite covers `tournaments-dal.test.ts`, `tournament-bracket.test.ts`, `tetrio-forward-facing.test.ts`, `GameSubHeader.test.tsx` (all 68 test files passed).
- TypeScript check (`npx tsc --noEmit`) passes with 0 errors.
- ESLint (`npm run lint`) passes with 0 errors.
- Next.js production build (`npm run build`) verifies that `/[game]/bracket` compiles cleanly as dynamic server routes.
