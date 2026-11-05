-- spec-060, phase 2 of 3 (CONSTRAIN): rosters are owned by a school, game and season, and a played roster can never be
-- deleted by accident.
--
-- Hand-written like 0043 onward (the drizzle-kit snapshot chain stops at 0042). Idempotent: every step is guarded or
-- uses IF [NOT] EXISTS, so re-running it changes nothing.
--
-- DEPLOY ORDER: apply 0060 and then this file BEFORE deploying the code that goes with them. The new code reads
-- `season_schools` and `rosters.school_id/game_id/season_id`; this file creates the `season_schools` view that makes
-- the new name work while the physical table is still called `teams`. 0062 (drop team_id, rename the table) is applied
-- AFTER the new code is live. Old code keeps working against the schema this file leaves behind: team_id is still
-- there, the 0060 trigger still fills the scope columns, and `teams` is untouched.

-- 1. Pick up anything an old-code insert wrote since 0060 (the trigger already fills these; this is the safety net),
--    then make the scope columns mandatory. SET NOT NULL fails loudly, and rolls the whole migration back, if any
--    roster is still unscoped.
DO $$
BEGIN
  -- Only while team_id still exists (it is gone after 0062, and then every roster is already scoped).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rosters' AND column_name = 'team_id') THEN
    EXECUTE $u$
      UPDATE public.rosters r
      SET school_id = t.school_id, game_id = t.game_id, season_id = t.season_id
      FROM public.teams t
      WHERE t.id = r.team_id
        AND (r.school_id IS NULL OR r.game_id IS NULL OR r.season_id IS NULL)
    $u$;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "rosters" ALTER COLUMN "school_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rosters" ALTER COLUMN "game_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rosters" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint

-- 2. A school has at most one roster of a given name per game and season. (The old unique (team_id, name) index stays
--    until 0062: old code's ON CONFLICT (team_id, name) still needs it.)
CREATE UNIQUE INDEX IF NOT EXISTS "rosters_scope_name_unique_idx" ON "rosters" USING btree ("school_id", "game_id", "season_id", "name");--> statement-breakpoint

-- 3. matches -> rosters becomes RESTRICT: deleting a roster that has matches is refused by the database instead of
--    silently deleting the matches (scores, standings). Constraints are found by what they reference, not by name.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.matches'::regclass AND contype = 'f' AND confrelid = 'public.rosters'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.matches
    ADD CONSTRAINT matches_home_roster_id_rosters_id_fk FOREIGN KEY (home_roster_id) REFERENCES public.rosters (id) ON DELETE RESTRICT;
  ALTER TABLE public.matches
    ADD CONSTRAINT matches_away_roster_id_rosters_id_fk FOREIGN KEY (away_roster_id) REFERENCES public.rosters (id) ON DELETE RESTRICT;
END $$;--> statement-breakpoint

-- 4. The new name for the membership table, usable before the rename. `season_schools` is a simple, auto-updatable view
--    over `teams`, so the new code's SELECT / INSERT / UPDATE / DELETE (including ON CONFLICT) go straight through.
--    Skipped when `season_schools` already exists (0062 has run) or `teams` is gone.
DO $$
BEGIN
  IF to_regclass('public.season_schools') IS NULL AND to_regclass('public.teams') IS NOT NULL THEN
    EXECUTE 'CREATE VIEW public.season_schools WITH (security_invoker = true) AS SELECT id, school_id, game_id, season_id, created_at, updated_at FROM public.teams';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_schools TO service_role';
  END IF;
END $$;--> statement-breakpoint

-- 5. roster_standings gains the scope columns (appended, so existing columns keep their positions and old code is
--    unaffected). Skipped once team_id is gone.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rosters' AND column_name = 'team_id') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.roster_standings WITH (security_invoker = true) AS
      SELECT
        r.id, r.team_id, r.name, r.division, r.created_at, r.updated_at,
        (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status IN ('completed', 'forfeit')))::int AS wins,
        (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status IN ('completed', 'forfeit')))::int AS losses,
        r.school_id, r.game_id, r.season_id
      FROM rosters r
    $v$;
  END IF;
END $$;
