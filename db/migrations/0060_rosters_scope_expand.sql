-- spec-060, phase 1 of 4 (EXPAND): a roster belongs to a school, a game and a season on its own.
--
-- Hand-written like 0043 onward: the drizzle-kit snapshot chain stops at 0042, so `db:generate` refuses to run.
-- Idempotent end to end (IF NOT EXISTS, guarded UPDATEs, ON CONFLICT DO NOTHING, drop-if-exists): re-running it
-- changes nothing the second time. Nothing here deletes or rewrites existing data.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the code that goes with it. The new code writes
-- rosters.school_id / game_id / season_id, which do not exist until this runs. The old code keeps working
-- against the migrated database: the trigger below fills the three columns for any insert that only knows team_id.
--
-- LATER PHASES (not in this file): 0061 constrains (NOT NULL, unique per school/game/season/name, matches -> rosters
-- becomes RESTRICT), the switch PR moves readers and writers off team_id, and the contract PR drops team_id and
-- renames `teams` to `season_schools` (the membership table).

-- 1. The three scope columns. ON DELETE CASCADE keeps today's behaviour: deleting a school, game or season still
--    removes its rosters (they used to go via teams). Nullable until 0061.
ALTER TABLE "rosters" ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rosters" ADD COLUMN IF NOT EXISTS "game_id" uuid REFERENCES "games"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rosters" ADD COLUMN IF NOT EXISTS "season_id" uuid REFERENCES "seasons"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rosters_school_game_season_idx" ON "rosters" USING btree ("school_id", "game_id", "season_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rosters_season_id_idx" ON "rosters" USING btree ("season_id");--> statement-breakpoint

-- 2. Backfill from each roster's team. Guarded: only rows still missing a value are touched.
UPDATE "rosters" r
SET "school_id" = t."school_id", "game_id" = t."game_id", "season_id" = t."season_id"
FROM "teams" t
WHERE t."id" = r."team_id"
  AND (r."school_id" IS NULL OR r."game_id" IS NULL OR r."season_id" IS NULL);--> statement-breakpoint

-- 3. CRITICAL: a roster must never depend on a team row. Drop the rosters.team_id -> teams foreign key (whatever
--    drizzle named it) and make the column nullable, so deleting a team / membership row can never cascade-delete
--    rosters (and, through them, players). Looked up by what it references, so it is safe to re-run.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.rosters'::regclass AND contype = 'f' AND confrelid = 'public.teams'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.rosters DROP CONSTRAINT %I', c);
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "rosters" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint

-- 4. Old code inserts rosters knowing only team_id. Fill the scope columns from the team so those rows are never
--    born unscoped. SECURITY DEFINER with a pinned search_path so it also works for a role that cannot read `teams`.
CREATE OR REPLACE FUNCTION "rosters_fill_scope"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."team_id" IS NOT NULL AND (NEW."school_id" IS NULL OR NEW."game_id" IS NULL OR NEW."season_id" IS NULL) THEN
    SELECT t."school_id", t."game_id", t."season_id"
      INTO NEW."school_id", NEW."game_id", NEW."season_id"
    FROM "teams" t WHERE t."id" = NEW."team_id";
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "rosters_fill_scope_trg" ON "rosters";--> statement-breakpoint
CREATE TRIGGER "rosters_fill_scope_trg" BEFORE INSERT ON "rosters"
FOR EACH ROW EXECUTE FUNCTION "rosters_fill_scope"();--> statement-breakpoint

-- 5. Membership rows. `teams` becomes the (school, game, season) membership table, so every scope that already
--    has a roster, a standings snapshot or a tournament appearance needs one. ON CONFLICT DO NOTHING on the
--    existing unique (school_id, game_id, season_id) index.
--    (a) scopes that rosters already carry (no-op today; keeps the invariant if a roster ever outlives its team).
INSERT INTO "teams" ("school_id", "game_id", "season_id")
SELECT DISTINCT r."school_id", r."game_id", r."season_id"
FROM "rosters" r
WHERE r."school_id" IS NOT NULL AND r."game_id" IS NOT NULL AND r."season_id" IS NOT NULL
ON CONFLICT ("school_id", "game_id", "season_id") DO NOTHING;--> statement-breakpoint
--    (b) archived standings snapshots: the game comes from the season.
INSERT INTO "teams" ("school_id", "game_id", "season_id")
SELECT DISTINCT ss."school_id", s."game_id", ss."season_id"
FROM "season_standings" ss
JOIN "seasons" s ON s."id" = ss."season_id"
ON CONFLICT ("school_id", "game_id", "season_id") DO NOTHING;--> statement-breakpoint
--    (c) tournament appearances (either side), for tournaments tied to a season.
INSERT INTO "teams" ("school_id", "game_id", "season_id")
SELECT DISTINCT x."school_id", t."game_id", t."season_id"
FROM "tournament_matches" tm
JOIN "tournaments" t ON t."id" = tm."tournament_id" AND t."season_id" IS NOT NULL
CROSS JOIN LATERAL (VALUES (tm."home_school_id"), (tm."away_school_id")) AS x("school_id")
WHERE x."school_id" IS NOT NULL
ON CONFLICT ("school_id", "game_id", "season_id") DO NOTHING;
