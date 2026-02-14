# Esports School League Database

## Overview

A multi-game, multi-season database for managing a school esports league. Designed for Supabase (Postgres). Handles student turnover, multiple games, team rosters, match results, and computed standings.

---

## Tables

### Core Entities

| Table | Purpose |
|-------|---------|
| `games` | Each game the league supports (Valorant, LoL, etc.) |
| `schools` | Schools participating in the league |
| `people` | Every person (player, captain, president). Exists once, can appear on multiple rosters across games and seasons. `graduation_year` tracks when they leave. |
| `seasons` | Time periods for competition. `game_id` is nullable — NULL means league-wide, set means game-specific. |

### Teams & Rosters

| Table | Purpose |
|-------|---------|
| `teams` | One entry per school + game + season + division combo. e.g. "MIT Valorant A — Spring 2026". The `division` column is constrained to `'A'` or `'B'`. |
| `roster_entries` | Links a person to a team. `left_date = NULL` means active. When a player leaves or graduates, set `left_date` — their history is preserved. `ign`, `tracker_url`, and `role` are game-specific and can differ across rosters for the same person. |
| `team_roles` | Leadership assignments (captain, club president) per person per season. `team_id` is set for team-level roles (captain), NULL for school-wide roles (club president). |

### Matches

| Table | Purpose |
|-------|---------|
| `matches` | One row per match. `home_score` / `away_score` hold the universal match result (maps won, games won, etc. — whatever the game uses). `mvp_person_id` is nullable for games without MVPs. `match_details` is a JSONB column for game-specific breakdowns (see below). `status` tracks match state: `scheduled`, `completed`, `forfeit`, `postponed`, or `cancelled`. |

### match_details JSONB Examples

The `match_details` column is schemaless — Postgres does not enforce a structure. Keep it consistent per game but it does not need to match across games. Set to `null` for games that don't need it.

**Valorant:**
```json
[
  {"map": "Ascent", "home_rounds": 13, "away_rounds": 7},
  {"map": "Bind", "home_rounds": 10, "away_rounds": 13},
  {"map": "Haven", "home_rounds": 13, "away_rounds": 11}
]
```

**League of Legends:**
```json
[
  {"game": 1, "winner": "home", "duration_mins": 32},
  {"game": 2, "winner": "away", "duration_mins": 28},
  {"game": 3, "winner": "home", "duration_mins": 41}
]
```

**1v1 game / no sub-matches:** leave as `null`.

---

## Views

Views are saved queries that behave like read-only tables. No data is stored — Postgres runs the underlying query every time you read from a view. You never INSERT or UPDATE through views; you write to the real tables and the views reflect changes automatically.

### v_roster

Returns all **active** players (where `left_date IS NULL`) with their name, school, game, season, division, role, IGN, and tracker URL. Joins 5 tables so you don't have to.

```sql
-- All active Valorant players
SELECT * FROM v_roster WHERE game_name = 'Valorant';

-- Active roster for a specific school and season
SELECT * FROM v_roster
WHERE school_name = 'MIT' AND season_name = 'Spring 2026';

-- All graduating seniors still on rosters
SELECT * FROM v_roster WHERE graduation_year = 2026;
```

### v_standings

Computes match wins, match losses, sub-wins, and sub-losses **live** from completed matches. No cached data — always up to date.

- `match_wins` / `match_losses` — how many matches a team won or lost
- `sub_wins` / `sub_losses` — total `home_score` / `away_score` accumulated (maps in Valorant, games in LoL, etc.)

```sql
-- Valorant standings for a season
SELECT * FROM v_standings
WHERE game_name = 'Valorant' AND season_name = 'Spring 2026';

-- Standings for a specific school across all games
SELECT * FROM v_standings WHERE school_name = 'MIT';
```

### v_match_results

Human-readable match results with school names, divisions, game, season, scores, and MVP name. Includes `match_details` JSONB for drilling into game-specific data.

```sql
-- All completed Valorant matches
SELECT * FROM v_match_results
WHERE game_name = 'Valorant' AND status = 'completed';

-- Upcoming scheduled matches
SELECT * FROM v_match_results
WHERE status = 'scheduled' ORDER BY match_date;

-- Matches where a specific player was MVP
SELECT * FROM v_match_results WHERE mvp_name = 'John Smith';
```

---

## Data Entry Order

Foreign keys enforce insertion order. Follow this sequence:

1. `games` — add each game the league runs
2. `schools` — add participating schools
3. `seasons` — add seasons (optionally tied to a game)
4. `people` — add players and staff (requires school)
5. `teams` — add teams (requires school + game + season)
6. `roster_entries` — assign people to teams
7. `team_roles` — assign captains and presidents
8. `matches` — schedule and record matches

---

## TODO: Cached Standings

The `v_standings` view computes standings on the fly from `matches`. At small scale this is fine. If query performance becomes an issue:

1. Create a `standings` table with columns for `team_id`, `season_id`, pre-computed stats, and a `metadata JSONB` column for game-specific stats.
2. Drop the `v_standings` view and query the table instead.
3. Automate recomputation using either:
   - A **Postgres trigger** that fires after INSERT/UPDATE on `matches` and recalculates the affected teams' rows.
   - A **Supabase Edge Function** that listens for match changes and runs the recalculation.

This trades always-live data for faster reads at scale.

---

## TODO: Row Level Security (RLS)

RLS is **not enabled**. Before exposing this database through a frontend or the Supabase client API, enable RLS on all tables and add policies:

- **Public read** on non-sensitive tables: `games`, `schools`, `seasons`, `teams`, `roster_entries`, `matches`.
- **Authenticated-only read** on sensitive tables: `people` (contains emails, discord), `team_roles`.
- **Authenticated-only write** on all tables.
- **Optional: admin-only write** using an `admins` table and checking `auth.uid()` in policies.

Until RLS is set up, use the **Supabase Dashboard** or the **service_role key** for all access. The `anon` API key will not be able to read or write anything once RLS is enabled without policies.