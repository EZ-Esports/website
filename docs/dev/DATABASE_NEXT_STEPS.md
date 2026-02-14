# Building on the Database: Frontend & Admin Panel

## Overview

This doc covers how to build a frontend admin panel for league staff to manage data, and optionally a public-facing site for players and spectators. Everything connects to the Supabase database through Supabase's client library.

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Public Website     │     │    Admin Panel        │
│  (read-only views)   │     │  (read + write)       │
│                      │     │                       │
│  - Standings         │     │  - Manage schools     │
│  - Match results     │     │  - Manage rosters     │
│  - Rosters           │     │  - Record matches     │
│  - Schedules         │     │  - Assign staff       │
└────────┬─────────────┘     └────────┬──────────────┘
         │                            │
         │  anon key (public read)    │  authenticated (read + write)
         │                            │
         └────────────┬───────────────┘
                      │
              ┌───────▼────────┐
              │   Supabase     │
              │  (Postgres DB) │
              │  + Auth        │
              │  + RLS         │
              └────────────────┘
```

**Public site** uses the `anon` key — can only read non-sensitive data (once RLS is set up).

**Admin panel** requires login via Supabase Auth — can read everything and write to all tables.

### Reading Data (views work like tables)

```javascript
// Fetch standings for a specific game and season
const { data, error } = await supabase
  .from('v_standings')
  .select('*')
  .eq('game_name', 'Valorant')
  .eq('season_name', 'Spring 2026')
  .order('match_wins', { ascending: false });

// Fetch active roster for a school
const { data, error } = await supabase
  .from('v_roster')
  .select('*')
  .eq('school_name', 'MIT');

// Fetch match results
const { data, error } = await supabase
  .from('v_match_results')
  .select('*')
  .eq('status', 'completed')
  .order('match_date', { ascending: false });
```

### Writing Data (always to real tables)

```javascript
// Add a new player to a team
const { data, error } = await supabase
  .from('players')
  .insert({
    team_id: 1,
    person_id: 5,
    ign: 'PlayerName#NA1',
    role: 'Duelist',
    is_captain: false,
    is_substitute: false
  });

// Record a match result
const { data, error } = await supabase
  .from('matches')
  .update({
    status: 'completed',
    home_score: 2,
    away_score: 1,
    mvp_person_id: 5,
    match_details: [
      { map: 'Ascent', home_rounds: 13, away_rounds: 7 },
      { map: 'Bind', home_rounds: 10, away_rounds: 13 },
      { map: 'Haven', home_rounds: 13, away_rounds: 11 }
    ]
  })
  .eq('match_id', 1);
```

---

## Admin Panel Pages

### Suggested Page Structure

```
/admin
  /login              — Supabase Auth login
  /dashboard          — Overview stats (active seasons, upcoming matches, etc.)
  /schools            — CRUD for schools
  /people             — CRUD for people (search, filter by school/grad year)
  /seasons            — Create/manage seasons
  /games              — Manage supported games
  /teams              — Create teams per school/game/season
  /rosters            — Manage players on teams (add, remove, set captain)
  /staff              — Manage team_staff and org_staff
  /matches
    /schedule         — Create upcoming matches
    /results          — Record scores, MVP, match_details
  /standings          — View computed standings (read-only from v_standings)
```

### Key Workflows

#### 1. Season Setup Wizard

A multi-step flow that walks staff through:
1. Create or select a season
2. Select which games are active this season
3. Create teams for each school + game + division
4. Import or assign players to rosters
5. Assign captains and staff roles

This prevents the common mistake of forgetting steps in the data entry order.

#### 2. Match Day Flow

A single page for recording results:
1. Select the match from a list of scheduled matches for today/this week
2. Enter scores (`home_score`, `away_score`)
3. Fill in game-specific `match_details` — the form adapts based on the game:
   - **Valorant**: map picker + round scores for each map
   - **LoL**: game count + winner per game + optional duration
   - **Other**: raw JSON editor as fallback
4. Select MVP from a dropdown of players on both teams
5. Submit — sets `status = 'completed'` automatically

#### 3. Roster Management

A page per team showing:
- Current active players (from `players` where `left_date IS NULL`)
- Option to add a player (search `people`, assign IGN/role)
- Option to remove a player (sets `left_date`, doesn't delete)
- Toggle captain / substitute status
- Staff tab showing `team_staff` for that team

#### 4. End-of-Season / Graduation

A guided flow:
1. Shows all players with `graduation_year` matching the current year
2. Bulk-close their player entries (`left_date = CURRENT_DATE`)
3. Optionally mark returning players for the next season

---

## Authentication Setup

### Supabase Auth

Use Supabase's built-in auth for the admin panel. Simplest approach:

1. **Email + password** — create accounts for each staff member in Supabase Dashboard > Authentication
2. **Magic link** — passwordless login via email

```javascript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@league.org',
  password: 'securepassword'
});

// Check session
const { data: { session } } = await supabase.auth.getSession();

// Logout
await supabase.auth.signOut();
```

### Protecting Admin Routes

```javascript
// middleware or layout check
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  redirect('/admin/login');
}
```

### Connecting Auth to RLS (future)

Once RLS is enabled, the Supabase client automatically sends the user's auth token with every request. RLS policies check `auth.uid()` to determine access. No extra code needed — just define the policies.

---

## Public Website Pages

If you want a public-facing site for players and spectators:

```
/                     — Landing page
/standings            — Current standings from v_standings
/matches              — Match schedule and results from v_match_results
/teams/:school        — School page with rosters from v_roster
/players/:id          — Player profile from v_people
```

All read-only, using the `anon` key. No login required. Once RLS is set up, the anon key only has access to non-sensitive data.

---

## Development Phases

### Phase 1: Core Admin (start here)
- Login page with Supabase Auth
- Schools, games, seasons CRUD
- People management (add, search, edit)
- Team creation
- Player roster management

### Phase 2: Match Management
- Match scheduling
- Match result recording with game-specific forms
- Standings page (read from `v_standings`)

### Phase 3: Public Site
- Public standings page
- Match results and schedule
- Team/school pages with rosters

### Phase 4: Polish
- Enable RLS and write policies
- Season setup wizard
- End-of-season graduation workflow
- CSV import for bulk player/roster data
- Notifications (Discord webhook for match results)

---

## Supabase Features to Leverage

| Feature | Use Case |
|---------|----------|
| **Auth** | Admin login, RLS integration |
| **Realtime** | Live standings updates on public site — subscribe to `matches` table changes |
| **Edge Functions** | Automated standings recomputation, Discord notifications after match results |
| **Storage** | Team logos, player profile pictures (if needed later) |
| **Database Webhooks** | Trigger external services when data changes (e.g. notify Discord on new match result) |

---

## Quick Start Checklist

1. Set up a new Next.js or React project
2. Install `@supabase/supabase-js`
3. Add your Supabase URL and anon key to environment variables
4. Build the login page using Supabase Auth
5. Build the schools page as your first CRUD page — it's the simplest table
6. Expand from there following the phase plan above

The database is ready — the views handle all the complex joins. Your frontend just needs to read from views and write to tables.