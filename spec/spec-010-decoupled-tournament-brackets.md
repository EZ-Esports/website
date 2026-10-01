# spec-010 — Decoupled Tournament Competition Model & Forward-Facing Brackets

**Spec ID:** `spec-010`
**Date:** 2026-10-01
**Status:** In Progress
**Scope:** Architectural competition decoupling across games (`competitionModel: 'team' | 'tournament'`), database schema migration for structured tournament metadata, forward-facing tournament bracket UI powered by `bracketry`, and stage/group visualizer.

---

## Context & Motivation

Historically, the competition architecture assumed all titles followed traditional round-robin team leagues (e.g. Valorant, League of Legends) featuring multi-week calendar fixtures and split Varsity / Junior Varsity divisions.

However, titles like **TETR.IO** and **Teamfight Tactics** operate on tournament-style competition models (such as Challonge double-elimination brackets, group stages, and single-elimination knockouts). Forcing these games into the league schedule layout led to severe UX and architectural issues:
1. **Misleading Calendar**: Single-day weekend tournaments crammed all 20+ matches into one calendar square with an overflow badge, leaving 29 days blank.
2. **Missing Progression Context**: Match cards flattened chronological results without indicating progression (e.g. Winners Pilot Round vs Quarterfinals vs Grand Finals).
3. **Loss of Player Identity**: 1v1 / 2v2 participant IGNs recorded in match notes were obscured by top-level school-vs-school labels.
4. **Hardcoded Varsity/JV Division Tabs**: The schedule page assumed every game fields Varsity/JV squads, rendering empty tabs for individual games with undivided fields.
5. **Technical Debt of Free-Text Notes**: Relying on parsing free-text `matches.notes` for stages, rounds, and participant names was brittle, untyped, and unindexable in SQL.

---

## Design Decisions

### 1. Database Schema Migration (`0040_numerous_komodo.sql`)
To eliminate technical debt, structured tournament metadata was added directly to the PostgreSQL `matches` table via Drizzle ORM:
- **`stage`** (`text`, indexed): `'winners' | 'losers' | 'grand_finals' | 'knockout' | 'group' | 'other'`.
- **`round_name`** (`text`): e.g. `'Winners Pilot Round'`, `'Quarterfinals'`, `'Grand Finals'`.
- **`round_order`** (`integer`): 1-based order of the round progression within the stage.
- **`match_order`** (`integer`): 1-based order of the match within the round.
- **`bracket_group`** (`text`): e.g. `'Legends Group'`, `'Challengers Group'`.
- **`home_participant_name`** / **`away_participant_name`** (`text`): Individual player IGN or squad label for tournament titles.
- **SQL Backfill**: Migration `0040_numerous_komodo.sql` backfills any existing historical records containing colon-delimited round prefixes into their respective structured columns, while keeping `notes` strictly for real free-form notes.

### 2. Game Entity Model Decoupling (`competitionModel`)
Added `competitionModel: 'team' | 'tournament'` to `GameConfig` in `app/types/index.ts` and `GAMES` in `app/lib/constants.ts`:
- **`team` games** (Valorant, League of Legends):
  - Retain `/schedule` route with calendar month grid and Varsity / Junior Varsity filters.
  - Subheader nav displays **"Schedule"** and **"Teams & Rosters"**.
- **`tournament` games** (TETR.IO, Teamfight Tactics, osu!):
  - Primary canonical competition route is **`/[game]/bracket`**.
  - Direct access to `/[game]/schedule` cleanly returns `notFound()`.
  - Subheader nav displays **"Bracket"** and **"Participants & Rosters"**.

### 3. Tournament Bracket Framework (`bracketry`)
Instead of building and maintaining a custom tree renderer, tournament brackets are visualized using **`bracketry`**:
- **Zero-Dependency & React 19 Compatible**: Pure JavaScript/SVG bracket renderer with 0 dependencies (12kB gzipped), avoiding the React 19 peer dependency conflicts found in older component packages like `@g-loot/react-tournament-brackets`.
- **Automatic Layout & SVG Connectors**: Computes tree hierarchy, round spacing, responsive navigation, and SVG bezier connecting lines between matches.
- **Custom Player Node Markup**: Utilizes `getPlayerTitleHTML` to render the user-specified node hierarchy:
  - Primary line: Player IGN (bold white text).
  - Secondary line: School / team name (smaller muted font).
- **Match Interactivity**: Clicking a match invokes `onMatchClick`, opening `BracketMatchModal` for deep details (timestamps, full school names, notes, scores).

### 4. Forward-Facing Integrations
- **Game Sub-Header** (`GameSubHeader.tsx`): Conditionally links to `/bracket` vs `/schedule` and "Participants & Rosters" vs "Teams & Rosters".
- **Game Hub** (`GameHubView.tsx`): Next match button and Recent results link route to `/bracket` for tournament titles.
- **League Pulse** (`LeaguePulse.tsx`): Homepage pulse cards and footer navigation route tournament titles directly to `/[game]/bracket`.

---

## Verification
- Vitest suite covers `tournament-bracket.test.ts`, `tetrio-forward-facing.test.ts`, `GameSubHeader.test.tsx`.
- Type checking passes with 0 errors (`npx tsc --noEmit`).
- ESLint passes with 0 errors (`npm run lint`).
- Next.js production build (`npm run build`) verifies that `/[game]/bracket` compiles cleanly as dynamic server routes alongside existing paths.
