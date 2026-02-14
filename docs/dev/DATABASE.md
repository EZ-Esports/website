# Esports School League Database

## Overview

A multi-game, multi-season database for managing a school esports league. Designed for Supabase (Postgres). Handles student turnover, multiple games, team rosters, match results, staff roles at three levels (team, school, organization), and computed standings. Reference `docs/dev/DATABASE_SCHEMA.md` for the database schema.

---

## Tables

### Core Entities

| Table | Purpose |
|-------|---------|
| `games` | Each game the league supports (Valorant, LoL, etc.). `is_active` lets you retire a game without deleting it. |
| `schools` | Schools participating in the league. `is_active` lets you mark a school as inactive without losing history. |
| `people` | Every person in the system — players, staff, org admins. Exists once regardless of how many roles they hold. `school_id` is nullable for org staff or people with no school affiliation. `graduation_year` tracks when students leave. |
| `seasons` | Time periods for competition. `game_id` is nullable — NULL means league-wide season shared across all games, set means game-specific season. |

### Teams & Players

| Table | Purpose |
|-------|---------|
| `teams` | One entry per school + game + season + division. e.g. "MIT Valorant A — Spring 2026". `division` is constrained to `'A'` or `'B'`. |
| `players` | Links a person to a team as a player. `left_date = NULL` means active. `ign`, `tracker_url`, and `role` are game-specific and differ per roster. `is_captain` and `is_substitute` are booleans. Same person can be on multiple teams across games/seasons. |

### Staff

There are two levels of staff, and a person can hold roles in both simultaneously. A person can also be a player and staff at the same time.

| Table | Purpose |
|-------|---------|
| `team_staff` | Team or school-level staff. `team_id` set = team-level role (manager, coach). `team_id` NULL = school-wide role (club president). Scoped to a season. |
| `org_staff` | League organization-level staff (commissioner, admin, organizer). Not tied to any school or team. Uses `start_date` / `end_date` instead of seasons since org roles span across seasons. `end_date = NULL` means currently active. |

### Matches

| Table | Purpose |
|-------|---------|
| `matches` | One row per match. `home_score` / `away_score` hold the universal result (maps won, games won — whatever the game uses). `mvp_person_id` is nullable for games without MVPs. `match_details` is a JSONB column for game-specific breakdowns. `status` tracks state: `scheduled`, `completed`, `forfeit`, `postponed`, or `cancelled`. |

---

## match_details JSONB

The `match_details` column is schemaless — Postgres does not enforce any keys or structure. Keep it consistent per game but it does not need to match across games. Set to `null` for games that don't need it.

### Suggested Structures

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

### Querying JSONB

```sql
-- Expand maps in a specific match
SELECT jsonb_array_elements(match_details) AS map_data
FROM matches WHERE match_id = 1;

-- Find all matches played on Ascent
SELECT * FROM matches
WHERE match_details @> '[{"map": "Ascent"}]';

-- Extract round scores per map
SELECT
    elem->>'map' AS map_name,
    (elem->>'home_rounds')::INT AS home_rounds,
    (elem->>'away_rounds')::INT AS away_rounds
FROM matches,
     jsonb_array_elements(match_details) AS elem
WHERE match_id = 1;

-- Total rounds per side in a match
SELECT
    match_id,
    SUM((elem->>'home_rounds')::INT) AS total_home_rounds,
    SUM((elem->>'away_rounds')::INT) AS total_away_rounds
FROM matches,
     jsonb_array_elements(match_details) AS elem
WHERE match_id = 1
GROUP BY match_id;

-- Round differential for a team across all their matches
SELECT
    m.match_id,
    SUM(CASE
        WHEN m.team_home_id = 1 THEN (elem->>'home_rounds')::INT - (elem->>'away_rounds')::INT
        WHEN m.team_away_id = 1 THEN (elem->>'away_rounds')::INT - (elem->>'home_rounds')::INT
    END) AS round_diff
FROM matches m,
     jsonb_array_elements(m.match_details) AS elem
WHERE m.status = 'completed'
  AND (m.team_home_id = 1 OR m.team_away_id = 1)
GROUP BY m.match_id;
```

**Key operators:**
- `->>'key'` — get a JSON value as text
- `(->>'key')::INT` — cast a JSON value to integer
- `@>` — "contains" check for filtering
- `jsonb_array_elements()` — expands a JSON array into rows

---

## Views

Views are saved queries that behave like read-only tables. No data is stored — Postgres runs the underlying query every time you read from a view. You never INSERT or UPDATE through views; write to the real tables and views reflect changes automatically.

### v_roster

Active players (where `left_date IS NULL`) with name, school, game, season, division, role, IGN, captain status.

```sql
-- All active Valorant players
SELECT * FROM v_roster WHERE game_name = 'Valorant';

-- Active roster for a specific school and season
SELECT * FROM v_roster
WHERE school_name = 'MIT' AND season_name = 'Spring 2026';

-- All graduating seniors still on rosters
SELECT * FROM v_roster WHERE graduation_year = 2026;

-- All captains
SELECT * FROM v_roster WHERE is_captain = TRUE;
```

### v_standings

Computes match wins, losses, sub-wins, and sub-losses **live** from completed matches. Always up to date — no manual recalculation needed.

- `match_wins` / `match_losses` — matches won or lost
- `sub_wins` / `sub_losses` — total `home_score` / `away_score` accumulated (maps in Valorant, games in LoL, etc.)

```sql
-- Valorant standings for a season
SELECT * FROM v_standings
WHERE game_name = 'Valorant' AND season_name = 'Spring 2026';

-- Standings for a specific school across all games
SELECT * FROM v_standings WHERE school_name = 'MIT';
```

### v_match_results

Human-readable match results with school names, divisions, game, season, scores, match details, and MVP name.

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

### v_team_staff

All team and school-level staff with their title, school, team/game context, and season. School-wide roles (like president) show NULL for team and game fields.

```sql
-- All staff for a school this season
SELECT * FROM v_team_staff
WHERE school_name = 'MIT' AND season_name = 'Spring 2026';

-- All club presidents across the league
SELECT * FROM v_team_staff WHERE title = 'president';
```

### v_org_staff

Active organization-level staff only (`end_date IS NULL`). Shows name, contact info, title, and start date.

```sql
-- All current org staff
SELECT * FROM v_org_staff;

-- Find a specific role
SELECT * FROM v_org_staff WHERE title = 'commissioner';
```

### v_people

Unified view of every person in the system. Returns basic info plus three JSON arrays showing all roles they currently hold:

- `active_player_roles` — teams they're playing on (game, division, role, captain status, season)
- `team_staff_roles` — team/school staff positions (title, school, season)
- `org_staff_roles` — org-level positions (title, start date)

```sql
-- Full overview of one person
SELECT * FROM v_people WHERE first_name = 'John' AND last_name = 'Smith';

-- Everyone from a specific school
SELECT * FROM v_people WHERE school_name = 'MIT';

-- Find people who are both players and staff
SELECT * FROM v_people
WHERE active_player_roles::TEXT != '[]'
  AND team_staff_roles::TEXT != '[]';
```

---

## Indexes

Indexes speed up queries by letting Postgres jump directly to matching rows instead of scanning every row in a table. Like a book index — instead of reading every page, you look up the term and go straight to the right page. Postgres uses them automatically. They cost a tiny bit of extra storage and slightly slow inserts, but the read speed improvement is almost always worth it.

| Index | Speeds up |
|-------|-----------|
| `idx_people_school` | "All people from this school" |
| `idx_people_grad_year` | "All graduating seniors" — useful for turnover management |
| `idx_teams_school_season` | "All teams for this school in this season" — composite, also works for just `school_id` |
| `idx_teams_game` | "All teams for Valorant" |
| `idx_players_team` | "Everyone on this team" — used by `v_roster` |
| `idx_players_person` | "Every team this person has been on" |
| `idx_staff_person` | "All staff roles for this person" |
| `idx_staff_school_season` | "All staff for this school this season" |
| `idx_org_staff_person` | "Org roles for this person" |
| `idx_matches_season` | "All matches in this season" |
| `idx_matches_game` | "All matches for this game" |
| `idx_matches_teams` | "All matches this team played" — composite, used heavily by `v_standings` |
| `idx_matches_details` | Queries inside `match_details` JSONB — uses GIN index for structured data |
| `idx_matches_mvp` | "How many MVPs has this player earned" |

---

## Data Entry Order

Foreign keys enforce insertion order. Follow this sequence:

1. `games` — add each game the league runs
2. `schools` — add participating schools
3. `seasons` — add seasons (optionally tied to a game)
4. `people` — add players and staff (school optional for org staff)
5. `teams` — create teams (requires school + game + season)
6. `players` — assign people to teams as players
7. `team_staff` — assign team/school-level staff roles
8. `org_staff` — assign org-level staff roles
9. `matches` — schedule and record matches

---

## Common Queries

### Adding Data

```sql
-- Add a game
INSERT INTO games (name) VALUES ('Valorant');

-- Add a school
INSERT INTO schools (name) VALUES ('MIT');

-- Add a league-wide season
INSERT INTO seasons (name, start_date, end_date)
VALUES ('Spring 2026', '2026-01-15', '2026-05-15');

-- Add a game-specific season
INSERT INTO seasons (game_id, name, start_date, end_date)
VALUES (1, 'Valorant Spring 2026', '2026-01-15', '2026-05-15');

-- Add a person (with school)
INSERT INTO people (first_name, last_name, email, discord, graduation_year, school_id)
VALUES ('John', 'Smith', 'john@mit.edu', 'johnsmith.', 2027, 1);

-- Add a person (no school — org staff)
INSERT INTO people (first_name, last_name, email, discord)
VALUES ('Jane', 'Doe', 'jane@league.org', 'janedoe.');

-- Create a team
INSERT INTO teams (school_id, game_id, season_id, division)
VALUES (1, 1, 1, 'A');

-- Add a player to a team
INSERT INTO players (team_id, person_id, ign, tracker_url, role, is_captain)
VALUES (1, 1, 'JohnSmith#NA1', 'https://tracker.gg/valorant/profile/...', 'Duelist', TRUE);

-- Add team staff (manager for a specific team)
INSERT INTO team_staff (person_id, team_id, school_id, season_id, title)
VALUES (3, 1, 1, 1, 'manager');

-- Add school staff (club president, no team)
INSERT INTO team_staff (person_id, team_id, school_id, season_id, title)
VALUES (2, NULL, 1, 1, 'president');

-- Add org staff
INSERT INTO org_staff (person_id, title)
VALUES (4, 'commissioner');
```

### Scheduling and Recording Matches

```sql
-- Schedule a match
INSERT INTO matches (season_id, game_id, match_date, team_home_id, team_away_id)
VALUES (1, 1, '2026-02-20', 1, 2);

-- Record a completed Valorant match (2-1 with map details)
UPDATE matches
SET status = 'completed',
    home_score = 2,
    away_score = 1,
    mvp_person_id = 1,
    match_details = '[
      {"map": "Ascent", "home_rounds": 13, "away_rounds": 7},
      {"map": "Bind", "home_rounds": 10, "away_rounds": 13},
      {"map": "Haven", "home_rounds": 13, "away_rounds": 11}
    ]'::JSONB
WHERE match_id = 1;

-- Record a forfeit
UPDATE matches
SET status = 'forfeit', home_score = 2, away_score = 0
WHERE match_id = 2;
```

### Player Movement

```sql
-- Player leaves a team
UPDATE players
SET left_date = CURRENT_DATE
WHERE person_id = 1 AND team_id = 1;

-- Transfer: player switches schools
-- Step 1: close out old player entry
UPDATE players
SET left_date = CURRENT_DATE
WHERE person_id = 1 AND left_date IS NULL;

-- Step 2: update their school
UPDATE people SET school_id = 2 WHERE person_id = 1;

-- Step 3: add them to a new team
INSERT INTO players (team_id, person_id, ign, role)
VALUES (5, 1, 'JohnSmith#NA1', 'Duelist');
```

### Useful Lookups

```sql
-- All active players for a school across all games
SELECT * FROM v_roster WHERE school_name = 'MIT';

-- Players graduating this year still on rosters
SELECT * FROM v_roster WHERE graduation_year = 2026;

-- A team's full match history
SELECT * FROM v_match_results
WHERE (home_school = 'MIT' AND home_division = 'A')
   OR (away_school = 'MIT' AND away_division = 'A');

-- MVP leaderboard for a season
SELECT mvp_name, COUNT(*) AS mvp_count
FROM v_match_results
WHERE season_name = 'Spring 2026' AND mvp_name IS NOT NULL
GROUP BY mvp_name
ORDER BY mvp_count DESC;

-- Full profile of a person (all roles)
SELECT * FROM v_people
WHERE first_name = 'John' AND last_name = 'Smith';

-- All staff across the entire league this season
SELECT * FROM v_team_staff WHERE season_name = 'Spring 2026'
UNION ALL
SELECT org_staff_id, first_name, last_name, NULL, discord, title, NULL, NULL, NULL, NULL
FROM v_org_staff;
```

---

## Graduation & Student Turnover

### End of Season

1. **Identify graduating players:**
```sql
SELECT * FROM v_roster WHERE graduation_year = 2026;
```

2. **Close their player entries** (do NOT delete — history is preserved):
```sql
UPDATE players
SET left_date = CURRENT_DATE
WHERE person_id IN (
    SELECT person_id FROM people WHERE graduation_year = 2026
)
AND left_date IS NULL;
```

3. **Verify they're off active rosters:**
```sql
SELECT * FROM v_roster WHERE graduation_year = 2026;
-- Should return nothing
```

### New Season Setup

4. **Create new season:**
```sql
INSERT INTO seasons (name, start_date, end_date)
VALUES ('Fall 2026', '2026-09-01', '2026-12-15');
```

5. **Create new teams.** Teams are per-season, so even returning schools need new rows:
```sql
INSERT INTO teams (school_id, game_id, season_id, division)
VALUES (1, 1, 2, 'A');
```

6. **Add returning players.** They already exist in `people` — just create new player entries:
```sql
INSERT INTO players (team_id, person_id, ign, role, is_captain)
VALUES (3, 2, 'ReturningPlayer#NA1', 'Controller', FALSE);
```

7. **Add new players** — create in `people` first, then add player entries.

8. **Assign staff roles** for the new season via `team_staff`.

### Important Rules

- **Never delete people.** Historical data (past rosters, MVPs) depends on them.
- **Never delete old player entries.** Set `left_date` instead.
- **Old seasons, teams, and matches stay forever.** They're your historical record. Filter by season when you only want current data.

---

## Common Mistakes to Avoid

- **Deleting a person instead of setting `left_date`** — breaks historical roster and MVP records.
- **Forgetting to create new teams each season** — teams are scoped to a season. Last season's team can't be reused.
- **Inserting a match before both teams exist** — foreign keys will reject it.
- **Setting scores without updating `status` to `'completed'`** — standings only count completed matches. Scored but `'scheduled'` matches are invisible to standings.
- **Inconsistent `match_details` structure** — Postgres won't enforce it, but your queries will break. Stay consistent per game.
- **Forgetting `school_id` is nullable** — org staff don't need a school, but players and team staff always should have one via their team/school reference.

---

## TODO: Cached Standings

`v_standings` computes live from `matches`. At small scale this is fine. If performance becomes an issue:

1. Create a `standings` table with `team_id`, `season_id`, pre-computed stats, and a `metadata JSONB` column for game-specific stats.
2. Drop `v_standings` and query the table instead.
3. Automate recomputation with either:
   - A **Postgres trigger** on INSERT/UPDATE on `matches`.
   - A **Supabase Edge Function** that listens for match changes.

Trades always-live data for faster reads at scale.

---

## TODO: Row Level Security (RLS)

RLS is **not enabled**. Before exposing through a frontend or Supabase client API, enable RLS on all tables and add policies:

- **Public read** on non-sensitive tables: `games`, `schools`, `seasons`, `teams`, `players`, `matches`.
- **Authenticated-only read** on sensitive tables: `people` (emails, discord), `team_staff`, `org_staff`.
- **Authenticated-only write** on all tables.
- **Optional: admin-only write** using an `admins` table and `auth.uid()` checks.

Until then, use the **Supabase Dashboard** or **service_role key** for all access.