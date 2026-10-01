# spec-010 — Decoupled Tournament Competition Model & Forward-Facing Brackets

**Spec ID:** `spec-010`
**Date:** 2026-10-01
**Status:** In Progress
**Scope:** Architectural competition decoupling across games (`competitionModel: 'team' | 'tournament'`), forward-facing tournament bracket UI, and stage/group visualizer.

---

## Context & Motivation

Historically, the competition architecture assumed all titles followed traditional round-robin team leagues (e.g. Valorant, League of Legends) featuring multi-week calendar fixtures and split Varsity / Junior Varsity divisions.

However, titles like **TETR.IO** and **Teamfight Tactics** operate on tournament-style competition models (such as Challonge double-elimination brackets, group stages, and single-elimination knockouts). Forcing these games into the league schedule layout led to severe UX issues:
1. **Misleading Calendar**: Single-day weekend tournaments crammed all 20+ matches into one calendar square with an overflow badge, leaving 29 days blank.
2. **Missing Progression Context**: Match cards flattened chronological results without indicating progression (e.g. Winners Pilot Round vs Quarterfinals vs Grand Finals).
3. **Loss of Player Identity**: 1v1 / 2v2 participant IGNs recorded in match notes were obscured by top-level school-vs-school labels.
4. **Hardcoded Varsity/JV Division Tabs**: The schedule page assumed every game fields Varsity/JV squads, rendering empty tabs for individual games with undivided fields.

---

## Design Decisions

### 1. Game Entity Model Decoupling (`competitionModel`)
Added `competitionModel: 'team' | 'tournament'` to `GameConfig` in `app/types/index.ts` and `GAMES` in `app/lib/constants.ts`:
- **`team` games** (Valorant, League of Legends):
  - Retain `/schedule` route with calendar month grid and Varsity / Junior Varsity filters.
  - Subheader nav displays **"Schedule"** and **"Teams & Rosters"**.
- **`tournament` games** (TETR.IO, Teamfight Tactics, osu!):
  - Primary canonical competition route is **`/[game]/bracket`**.
  - Direct access to `/[game]/schedule` cleanly returns `notFound()`.
  - Subheader nav displays **"Bracket"** and **"Participants & Rosters"**.

### 2. Tournament Bracket Visualizer & Parser
Introduced `app/lib/bracket.ts`, `app/components/tournament/BracketNode.tsx`, and `app/components/tournament/TournamentBracketView.tsx`:
- **Match Parsing**:
  - Parses match `notes` to extract stage classifications (`winners`, `losers`, `knockout`, `grand_finals`, `group`).
  - Extracts individual player IGNs/pairs and pairs them with school names.
- **Node Anatomy**:
  - Primary line: Player IGN (bold) + score + winner highlight.
  - Secondary line: School / team name (smaller muted font).
  - Winner status: Accent glow, trophy icon, bold score chip.
- **Dynamic Stages & Group Navigation**:
  - Double elimination: Stage tabs for `Winners Bracket`, `Losers Bracket`, `Grand Finals`.
  - Group play (e.g. 2025–26 TETR.IO): Stage tabs for `Legends Group` and `Challengers Group` (with live round-robin standings tables and match cards) + `Knockout Stage`.
  - Modal details on click displaying kickoffs, scores, round metadata, and notes.

### 3. Forward-Facing Integrations
- **Game Sub-Header** (`GameSubHeader.tsx`): Conditionally links to `/bracket` vs `/schedule` and "Participants & Rosters" vs "Teams & Rosters".
- **Game Hub** (`GameHubView.tsx`): Next match button and Recent results link route to `/bracket` for tournament titles.
- **League Pulse** (`LeaguePulse.tsx`): Homepage pulse cards and footer navigation route tournament titles directly to `/[game]/bracket`.

---

## Verification
- Vitest suite covers `tournament-bracket.test.ts`, `tetrio-forward-facing.test.ts`, `GameSubHeader.test.tsx`.
- Type checking passes with 0 errors (`npx tsc --noEmit`).
- ESLint passes with 0 errors (`npm run lint`).
- Next.js production build (`npm run build`) verifies that `/[game]/bracket` compiles cleanly as dynamic server routes alongside existing paths.
