# spec-060: School-owned, season-scoped rosters; season membership

- **Status:** Implemented on branch `rosters-expand-0060` (one PR: expand, constrain, switch, contract), stacked on main after #332. Migrations `0060`, `0061`, `0062` are written and NOT applied anywhere; nothing was run against any production database.
- **Date:** 2026-11-05
- **Scope:** `db/migrations/0060..0062` (+ journal), `app/lib/db/schema.ts`, `app/lib/db/season-membership.ts` (new), every roster/team reader and writer (matches, standings, teams, school-rosters, season-setup, roster-scope, roster-removal, portal, manager-auth, staff roster actions, generate season, scheduling, league deletes, seed-gold, purge script), League Setup (Add school, Remove school, school pages), `db/verify-roster-backfill.ts`, local-dev tooling (`db/local/*`, [docs/dev/LOCAL_DB.md](../docs/dev/LOCAL_DB.md)).

## Why

A roster belonged to a `teams` row (school + game + season) through `rosters.team_id ON DELETE CASCADE`. That made the team row load-bearing: deleting it deleted rosters and players, and "this school is in this season" and "these are its rosters" were one fact, so a school could not be taken out of a season without touching its data.

## Model (approved by the user)

- A **roster** belongs to a school, a game and a season by itself: `rosters.school_id`, `game_id`, `season_id` (NOT NULL), unique `(school_id, game_id, season_id, name)`.
- **`teams` becomes the membership table `season_schools`**: one row per (school, game, season), nothing hangs off it. In TypeScript it is `seasonSchools` (`pgTable('season_schools')`). Removing a school from a season deletes only that row.
- `matches -> rosters` is `RESTRICT`. `league.ts` season and game deletes delete the rosters and players explicitly and REFUSE when matches exist.
- Re-adding a school adds only the missing divisions (it never recreates what exists).
- Public reads need a positive membership join. Derived (view) standings keep counting already-played matches against a removed school (no view change). Tournament games (TFT, osu!, TETR.IO) do not need membership for brackets.

## Migrations (hand-written, idempotent, separate files)

Hand-written like 0043 onward (the drizzle-kit snapshot chain stops at 0042). Each can be re-run safely (guards, `IF [NOT] EXISTS`, `ON CONFLICT DO NOTHING`).

| File | Phase | Does |
|---|---|---|
| `0060_rosters_scope_expand` | expand | Adds nullable `rosters.school_id/game_id/season_id` + indexes, backfills them from `teams`, **drops the `rosters.team_id -> teams` FK** and makes `team_id` nullable (so a membership row can never cascade-delete rosters), adds a `BEFORE INSERT` trigger that fills the scope for old-code inserts, and backfills membership rows for schools with an archived standings snapshot (not for tournament appearances: tournament games do not need membership for brackets). |
| `0061_rosters_scope_constrain` | constrain | Scope columns `NOT NULL`, unique `(school, game, season, name)`, `matches -> rosters` FKs `RESTRICT`, creates the **compatibility view `season_schools`** (simple, auto-updatable, over `teams`) so the new name works before the rename, and widens `roster_standings` with `school_id/game_id/season_id`. |
| `0062_rosters_scope_contract` | contract | Drops the view and renames `teams` to `season_schools` (and its indexes), rewrites the anon/authenticated RLS policies on rosters, players and matches that named `team_id`, drops the trigger and `rosters.team_id` (+ its indexes), and rebuilds `roster_standings` without `team_id`. |

The code never touches `rosters.team_id`, and uses the name `season_schools`, which is the view after 0061 and the real table after 0062. So the same build works on both schemas, and 0062 can be applied after the code is live.

### Deploy order and the window

1. Apply **0060 then 0061 BEFORE deploying** this code. Both are backward compatible: the old code keeps working against them (it still reads `teams` and `rosters.team_id`; the trigger fills the scope columns; deleting a team no longer cascades, which only makes it safer).
2. Deploy the code.
3. Apply **0062 AFTER the new code is live.** (Applied before, the old code would break: it needs `teams` and `team_id`.)

**What breaks if the code is deployed before 0060/0061:** every page that reads rosters, teams, standings or matches fails (the new queries select `rosters.school_id/game_id/season_id` and read `season_schools`, which do not exist): the public team directory, school team pages, standings, schedule, hub, archive, home results, the manager portal, and the whole staff portal's roster/season/match screens. Vercel deploys on merge, so either apply 0060/0061 immediately before merging, or hold the deploy. Between merging and migrating there is no partial mode.

### Deviations to know about

- Step 5(b) of 0060 adds `season_schools` rows (with no rosters) for schools that have an archived standings snapshot, so snapshot-based public reads can require membership. Those empty memberships are kept out of the product: the public team directory skips a season with no rosters, the admin "teams without a roster" count looks at active seasons only, and the season hub hides an archived season's school tile that has no rosters and never asks for missing rosters there (the school still counts as a member, so it is not offered in the Add school picker). `db/verify-roster-backfill.ts` prints how many rows step 5(b) would add.
- Tournament appearances get no membership row; tournament brackets do not read membership.
- **Journal ordering:** the `when` values of 0060 to 0062 (1790882000030 to 1790882000032) are deliberately above every earlier entry, and above any other branch's pending migration. The migrator applies only entries newer than the last one applied, so any LATER migration (including another branch's, e.g. a 0059 or 0063) must carry a `when` higher than 1790882000032, or it will be skipped silently once these have run.

## Behaviour

- **Add school** (`addSchoolToSeason`): per-(season, school) advisory lock; find-or-create the membership row; create only the rosters the game fields that the school does not already have for that season; audit `restore_school_to_season` when it brings back existing rosters.
- **Remove school** (`removeSchoolFromSeason`): deletes the membership row only, audited (`remove_school_from_season`), idempotent, refreshes public caches. Rosters, players and every match are untouched. League Setup shows a confirm dialog and the tile action; the school page of a removed school disappears from the season, while Schools & Rosters still lists its rosters flagged "Not in this season".
- **Public visibility**: team directory, school team page and computed standings join `season_schools`; snapshot standings (divisions, hub summary, archive champion) join it through `snapshotMember`; every public match query LEFT JOINs the membership of each side and requires both (`bothMembers`); staff match lists omit that requirement. The archive match count counts only fixtures between two members.
- **Manager portal**: `assertManagerForRoster` reads the roster's own scope and requires membership for non-staff; match-result and reschedule actions refuse a manager when either side is not a member (staff exempt); manager roster creation requires membership (it no longer creates one); a player's join link stops working when the school is no longer in the invite's season.
- **Sibling rule and locks** key on the scope (`scopeKey`: school, game, season) instead of the team id.
- **Scheduling**: Schedule match and Generate season refuse a school that is not a member; Generate reads rosters by school/season.
- **League deletes**: `deleteSeasonInDb` / `deleteGameInDb` refuse when matches exist (a `DeleteRefusedError`, whose message League Setup now shows as written) and otherwise delete players, rosters, then the season/game, explicitly. A manager deleting a roster that has matches gets a clear refusal too. The player's final submit re-checks that the school is still in the invite's season, as validation does.
- **seed-gold** keys rosters by (school, game, season, name); the purge script reads `rosters.season_id` and `season_schools`.

## Verification

- PGlite tests apply the real migrations: `rosters-scope-expand-pglite` (0060 backfill, FK drop, trigger, idempotent re-runs), `rosters-contract-pglite` (the gap schema end to end through the new code: add/remove/restore via the view, a public read; the final schema; re-running 0061 and 0062; public match list hiding a removed school; restore; explicit season deletes), plus the existing roster-removal, purge and student-ID suites on the final schema.
- `db/verify-roster-backfill.ts` (`npm run db:verify:roster-backfill`) is read-only and gated by `assertSeedTargetAllowed()`; it is for the state after 0060/0061 and has not been run against anything.
- Local run: [docs/dev/LOCAL_DB.md](../docs/dev/LOCAL_DB.md) (`npm run db:local:start`, `db:local:seed`, `dev:local`). The seed is tested against both schema stages.

## Not verified

No migration has run on Supabase; PGlite is not Supabase (the `auth` schema and roles are stand-ins, and RLS policies are only loaded, not exercised). The 0062 policy rewrite and the `season_schools` view grants should be rehearsed on a restored backup. The local app was started against the local database and served public pages, but the single-connection fix (`DATABASE_POOL_MAX=1`) was not re-verified after it was added. Browser verification of the new screens was not done.
