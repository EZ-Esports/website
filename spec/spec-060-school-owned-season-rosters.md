# spec-060: School-owned, season-scoped rosters (phase 1 of 4: expand)

- **Status:** Phase 1 (EXPAND) implemented on branch `rosters-expand-0060`, stacked on `worktree-agent-a1034cb896548c04e` (PR #332). Migration `0060_rosters_scope_expand` is written, NOT applied, and nothing was run against any database. No behaviour change.
- **Date:** 2026-11-04
- **Scope:** `db/migrations/0060_rosters_scope_expand.sql` (+ journal), `app/lib/db/schema.ts` (`rosters`), the roster writers (`season-schools-actions.ts`, `generate-season-actions.ts`, `schools/[schoolId]/rosters/actions.ts`, `roster-scope.ts`, `portal-actions.ts`, `db/seed-gold.ts`), `db/verify-roster-backfill.ts`, tests.

## Why

Today a roster belongs to a `teams` row (school + game + season) through `rosters.team_id ON DELETE CASCADE`. That makes the team row load-bearing: deleting it deletes the rosters and, through them, the players. It also makes "this school is in this season" and "these are the school's rosters" the same fact, so a school cannot be taken out of a season without touching its data.

Target model (approved by the user):

- A **roster** belongs to a school, a game and a season by itself (`rosters.school_id`, `game_id`, `season_id`).
- **`teams` becomes the membership table** `season_schools`: one row per (school, game, season), nothing else hangs off it. Removing a school from a season deletes only that row; rosters, players and matches are untouched.
- `matches -> rosters` becomes `RESTRICT`. `league.ts` season and game deletes must explicitly delete the rosters and players and REFUSE when matches exist.
- Re-adding a school adds only the missing divisions.
- Opponents' derived standings keep counting already-played matches against a removed school (no view change).
- Tournament games (TFT, osu!, TETR.IO) do not require membership for their brackets.

## Phases and deploy order

Each phase is its own PR. Migrations are written as files only; the user says when to run them, after the PR merges.

1. **Expand (this spec, migration 0060).** Additive only. **Apply 0060 BEFORE deploying this code**: the new code writes `rosters.school_id/game_id/season_id`, which do not exist until the migration runs. The reverse is safe: old code keeps working on a migrated database because a trigger fills the new columns for any insert that only knows `team_id`.
2. **Constrain (0061).** After `db/verify-roster-backfill.ts` reports every roster scoped and consistent: `NOT NULL` on the three columns, unique (school, game, season, name), `matches -> rosters` to `RESTRICT`, and the explicit-delete rule in `league.ts`.
3. **Switch (PR2).** Readers and writers move from `team_id` to the scope columns; public/portal queries stop joining `teams` for rosters and use membership only to decide who is in the season; Remove/Add school becomes a membership operation.
4. **Contract (PR3).** Drop `rosters.team_id`, rename `teams` to `season_schools`, drop the trigger and the compatibility code.

## Migration 0060 (idempotent, hand-written)

Hand-written like 0043 onward (the drizzle-kit snapshot chain stops at 0042). Every statement is safe to re-run.

1. Add nullable `rosters.school_id`, `game_id`, `season_id` (FKs `ON DELETE CASCADE`, so deleting a school, game or season still removes its rosters exactly as before) and indexes `(school_id, game_id, season_id)` and `(season_id)`.
2. Backfill from each roster's team, guarded: only rows still missing a value are updated.
3. **Critical:** drop the `rosters.team_id -> teams` foreign key (looked up by what it references, not by name) and make `team_id` nullable, so deleting a team / membership row can never cascade-delete rosters. The unique `(team_id, name)` index stays until 0061.
4. A `BEFORE INSERT` trigger (`rosters_fill_scope`, `SECURITY DEFINER`, pinned `search_path`) fills the three columns from `team_id` when a writer omits them.
5. Membership backfill with `ON CONFLICT (school_id, game_id, season_id) DO NOTHING`: scopes already on rosters (a no-op today), schools with an archived `season_standings` row (game from the season), and schools appearing in `tournament_matches` of a season-linked tournament.

**Visible effect to decide on before applying.** Step 5(b)/(c) adds `teams` rows (with no rosters) for archived-standings and tournament-only schools. Those rows exist today only implicitly; once added, anything that lists `teams` (the public team directory, the admin "teams without a roster" count) can show them. Run `db/verify-roster-backfill.ts` first: it prints how many rows steps (b) and (c) would add. If that is unwanted, delete those two statements from 0060 before applying; nothing else depends on them in this phase.

`roster_standings` is deliberately not widened in this phase (it selects explicit columns, so adding columns to `rosters` does not change it).

## Code in this phase

`schema.ts` declares the three columns with FKs and indexes; `teamId` stays `notNull` in the TypeScript type only so every reader and writer is unchanged (the database column is nullable). Every roster writer now sets the three columns explicitly (add-school, generate-season, the staff roster editor, the manager portal, the gold seed); the trigger is the safety net for anything that does not.

## Verification

`db/verify-roster-backfill.ts` (`npm run db:verify:roster-backfill`) is read-only (SELECTs only, `--dry-run` is the default and only mode), goes through `assertSeedTargetAllowed()`, and prints counts per game and season: rosters, unscoped, scope-vs-team mismatches, no-team, no-membership, plus the membership rows step 5 would still add. No names, emails or ids. Exit code 1 if the migration is missing or any roster is unscoped or inconsistent. **It has not been run.**

## Tests

`app/lib/db/__tests__/rosters-scope-expand-pglite.test.ts` applies every migration to an in-memory PGlite and checks: the columns and indexes, the dropped FK and nullable `team_id`, that deleting a team keeps its roster and player, that deleting a season still removes its rosters, the trigger (fills old-style inserts, leaves explicit values alone), the backfill of a legacy unscoped roster, membership backfill from standings and tournaments, and that re-running the file changes nothing. `db/__tests__/verify-roster-backfill.test.ts` covers the report. `roster-edit-actions.test.ts` and `add-school-to-season.test.ts` assert the writers set the new columns.

## Not verified

Nothing here ran against a real database; PGlite is not Supabase (the `auth` schema and roles are stand-ins, RLS policies are not exercised). The trigger's `SECURITY DEFINER` behaviour under Supabase roles and the real constraint name dropped in step 3 are worth a look on a restored backup before production.
