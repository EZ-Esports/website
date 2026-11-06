-- spec-060, migration 2 of 2 (CONTRACT): drop rosters.team_id and finish the rename `teams` -> `season_schools`.
--
-- Hand-written like 0043 onward. Idempotent: guarded, so re-running it changes nothing.
--
-- DEPLOY ORDER: apply this AFTER the code that goes with 0060 is live. Until then the old code (and the
-- compatibility view from 0060) still read `teams` and `rosters.team_id`. The new code never touches either, and it
-- uses the name `season_schools` that exists both as 0060's view and as this file's renamed table, so it keeps
-- working across this migration. Nothing here deletes a row of data. The migrator runs the whole file in one
-- transaction, so the view/table swap is atomic.

-- 1. The membership table takes its final name: drop 0060's compatibility view, rename the table, rename its indexes.
DO $$
BEGIN
  IF (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.season_schools')) = 'v' THEN
    EXECUTE 'DROP VIEW public.season_schools';
  END IF;
  IF to_regclass('public.season_schools') IS NULL AND to_regclass('public.teams') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.teams RENAME TO season_schools';
  END IF;
END $$;--> statement-breakpoint
ALTER INDEX IF EXISTS "teams_school_id_idx" RENAME TO "season_schools_school_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "teams_game_id_idx" RENAME TO "season_schools_game_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "teams_season_id_idx" RENAME TO "season_schools_season_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "teams_school_game_season_unique_idx" RENAME TO "season_schools_school_game_season_unique_idx";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_schools TO service_role;--> statement-breakpoint

-- 2. roster_standings is rebuilt without team_id (a column cannot be dropped while a view selects it).
DROP VIEW IF EXISTS public.roster_standings;--> statement-breakpoint

-- 2b. The row-level-security policies that gate anon / authenticated reads of rosters, players and matches name
--     rosters.team_id, which blocks dropping it. Re-create them on the school/game/season scope: a roster (and its
--     players, and a match between two such rosters) is public when its school is a member of the season
--     (a season_schools row), active, and the season is active, exactly the rule they enforced through teams.
DROP POLICY IF EXISTS "rosters_public_or_permission_select" ON "public"."rosters";--> statement-breakpoint
CREATE POLICY "rosters_public_or_permission_select" ON "public"."rosters"
FOR SELECT TO "anon", "authenticated"
USING (
  (SELECT "public"."has_permission"(24))
  OR EXISTS (
    SELECT 1
    FROM "public"."season_schools" t
    JOIN "public"."schools" s ON s."id" = t."school_id"
    JOIN "public"."seasons" se ON se."id" = t."season_id"
    WHERE t."school_id" = "rosters"."school_id" AND t."game_id" = "rosters"."game_id" AND t."season_id" = "rosters"."season_id"
      AND s."is_active" = true AND s."deleted_at" IS NULL
      AND se."is_active" = true
  )
);--> statement-breakpoint
DROP POLICY IF EXISTS "players_public_or_permission_select" ON "public"."players";--> statement-breakpoint
CREATE POLICY "players_public_or_permission_select" ON "public"."players"
FOR SELECT TO "anon", "authenticated"
USING (
  (SELECT "public"."has_permission"(8))
  OR EXISTS (
    SELECT 1
    FROM "public"."rosters" r
    JOIN "public"."season_schools" t ON t."school_id" = r."school_id" AND t."game_id" = r."game_id" AND t."season_id" = r."season_id"
    JOIN "public"."schools" s ON s."id" = t."school_id"
    JOIN "public"."seasons" se ON se."id" = t."season_id"
    WHERE r."id" = "players"."roster_id"
      AND s."is_active" = true AND s."deleted_at" IS NULL
      AND se."is_active" = true
  )
);--> statement-breakpoint
DROP POLICY IF EXISTS "matches_public_or_permission_select" ON "public"."matches";--> statement-breakpoint
CREATE POLICY "matches_public_or_permission_select" ON "public"."matches"
FOR SELECT TO "anon", "authenticated"
USING (
  (SELECT "public"."has_permission"(16))
  OR (
    EXISTS (
      SELECT 1 FROM "public"."seasons" se
      WHERE se."id" = "matches"."season_id" AND se."is_active" = true
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."rosters" r
      JOIN "public"."season_schools" t ON t."school_id" = r."school_id" AND t."game_id" = r."game_id" AND t."season_id" = r."season_id"
      JOIN "public"."schools" s ON s."id" = t."school_id"
      WHERE r."id" = "matches"."home_roster_id"
        AND t."season_id" = "matches"."season_id"
        AND s."is_active" = true AND s."deleted_at" IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."rosters" r
      JOIN "public"."season_schools" t ON t."school_id" = r."school_id" AND t."game_id" = r."game_id" AND t."season_id" = r."season_id"
      JOIN "public"."schools" s ON s."id" = t."school_id"
      WHERE r."id" = "matches"."away_roster_id"
        AND t."season_id" = "matches"."season_id"
        AND s."is_active" = true AND s."deleted_at" IS NULL
    )
  )
);--> statement-breakpoint

-- 3. Drop the compatibility trigger and rosters.team_id with its indexes.
DROP TRIGGER IF EXISTS "rosters_fill_scope_trg" ON "rosters";--> statement-breakpoint
DROP FUNCTION IF EXISTS public.rosters_fill_scope();--> statement-breakpoint
DROP INDEX IF EXISTS public.rosters_team_name_unique_idx;--> statement-breakpoint
DROP INDEX IF EXISTS public.rosters_team_id_idx;--> statement-breakpoint
ALTER TABLE "rosters" DROP COLUMN IF EXISTS "team_id";--> statement-breakpoint

-- 4. roster_standings again, keyed by school, game and season.
CREATE VIEW public.roster_standings WITH (security_invoker = true) AS
SELECT
  r.id, r.school_id, r.game_id, r.season_id, r.name, r.division, r.created_at, r.updated_at,
  (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status IN ('completed', 'forfeit')))::int AS wins,
  (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status IN ('completed', 'forfeit')))::int AS losses
FROM rosters r;--> statement-breakpoint
GRANT SELECT ON public.roster_standings TO anon, authenticated;
