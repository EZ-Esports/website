-- spec-060, migration 1 of 2 (EXPAND + BACKFILL + CONSTRAIN): a roster belongs to a school, a game and a season on its own.
--
-- Hand-written like 0043 onward: the drizzle-kit snapshot chain stops at 0042, so `db:generate` refuses to run.
-- Idempotent where it matters (IF NOT EXISTS, guarded UPDATEs, ON CONFLICT DO NOTHING, drop-if-exists). Nothing here
-- deletes or rewrites existing data.
--
-- ONE TRANSACTION: the migrator runs this whole file in a single transaction, so if a constraint step fails (for
-- example SET NOT NULL because a roster is still unscoped) the backfill rolls back with it and the database is left
-- exactly as it was. Rehearse on a restored backup first (docs/dev/LOCAL_DB.md, db:verify:roster-backfill).
--
-- ORDER INSIDE: columns, backfill, drop the rosters -> teams FK, insert trigger, membership backfill, provision the
-- missing rosters of every membership (Varsity/JV/All per game), and only then
-- NOT NULL / unique / matches -> rosters RESTRICT / the `season_schools` compatibility view / widened roster_standings.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the code that goes with it. The new code reads `season_schools`
-- and rosters.school_id / game_id / season_id; the compatibility view below makes the new name work while the physical
-- table is still called `teams`. Old code keeps working against the schema this file leaves behind: team_id is still
-- there, the trigger still fills the scope columns, and `teams` is untouched. Migration 0061 (drop team_id, rename the
-- table) is applied AFTER the new code is live.

-- 1. The three scope columns. ON DELETE CASCADE keeps today's behaviour: deleting a school, game or season still
--    removes its rosters (they used to go via teams). Nullable until step 6 below.
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
--    has a roster or a standings snapshot needs one. ON CONFLICT DO NOTHING on the
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
--    (c) deliberately absent: tournament games (TFT, osu!, TETR.IO) do not need membership for their brackets.

-- 6. Provision the rosters every existing membership should have, mirroring app/lib/season-schools.ts
--    (planSchoolRosters / allowedRosterDivisions): Valorant and League of Legends field Varsity (division A) and JV (B),
--    Minecraft Varsity only, TFT / osu! / TETR.IO a single `All`; a game this list does not know gets Varsity + JV, like
--    the code. Only a division the membership LACKS is added: an existing roster counts for its division under any name
--    or spelling (A / Varsity, B / JV, All; anything else counts as Varsity, as canonicalDivision does), so nothing is
--    duplicated. A new roster takes the division's name, or "<name> 2" ... if that name is taken. It creates NO
--    membership: it only gives each existing membership its rosters, in archived seasons too (the owner's choice). It
--    sets team_id so old code, which reads rosters through `teams`, sees them. Idempotent: a second run finds nothing
--    lacking. ON CONFLICT DO NOTHING guards any unique index.
DO $$
DECLARE
  m record;
  d record;
  cand text;
  n int;
BEGIN
  FOR m IN
    SELECT t.id AS team_id, t.school_id, t.game_id, t.season_id, g.slug AS game_slug
    FROM "teams" t JOIN "games" g ON g.id = t.game_id
  LOOP
    FOR d IN
      SELECT v.canon, v.stored
      FROM (VALUES ('Varsity', 'A', 1), ('JV', 'B', 2), ('All', 'All', 3)) AS v(canon, stored, ord)
      WHERE CASE
        WHEN m.game_slug IN ('team-fight-tactics', 'osu', 'tetris', 'tetr-io', 'tetrio') THEN v.canon = 'All'
        WHEN m.game_slug = 'minecraft' THEN v.canon = 'Varsity'
        ELSE v.canon IN ('Varsity', 'JV')
      END
      ORDER BY v.ord
    LOOP
      IF EXISTS (
        SELECT 1 FROM "rosters" r
        WHERE r."school_id" = m.school_id AND r."game_id" = m.game_id AND r."season_id" = m.season_id
          AND (CASE WHEN r."division" IN ('JV', 'B') THEN 'JV' WHEN r."division" = 'All' THEN 'All' ELSE 'Varsity' END) = d.canon
      ) THEN
        CONTINUE;
      END IF;
      cand := d.canon;
      n := 2;
      WHILE EXISTS (
        SELECT 1 FROM "rosters" r
        WHERE r."school_id" = m.school_id AND r."game_id" = m.game_id AND r."season_id" = m.season_id AND r."name" = cand
      ) OR EXISTS (SELECT 1 FROM "rosters" r WHERE r."team_id" = m.team_id AND r."name" = cand) LOOP
        cand := d.canon || ' ' || n;
        n := n + 1;
      END LOOP;
      INSERT INTO "rosters" ("team_id", "school_id", "game_id", "season_id", "name", "division")
      VALUES (m.team_id, m.school_id, m.game_id, m.season_id, cand, d.stored)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;--> statement-breakpoint

-- 7. Pick up anything an old-code insert wrote earlier in this file (the trigger already fills these; this is the safety net),
--    then make the scope columns mandatory. SET NOT NULL fails loudly, and rolls the whole migration back, if any
--    roster is still unscoped.
DO $$
BEGIN
  -- Only while team_id still exists (it is gone after 0061, and then every roster is already scoped).
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

-- 8. A school has at most one roster of a given name per game and season. (The old unique (team_id, name) index stays
--    until 0061: old code's ON CONFLICT (team_id, name) still needs it.)
CREATE UNIQUE INDEX IF NOT EXISTS "rosters_scope_name_unique_idx" ON "rosters" USING btree ("school_id", "game_id", "season_id", "name");--> statement-breakpoint

-- 9. matches -> rosters becomes RESTRICT: deleting a roster that has matches is refused by the database instead of
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

-- 10. The new name for the membership table, usable before the rename. `season_schools` is a simple, auto-updatable view
--    over `teams`, so the new code's SELECT / INSERT / UPDATE / DELETE (including ON CONFLICT) go straight through.
--    Skipped when `season_schools` already exists (0061 has run) or `teams` is gone.
DO $$
BEGIN
  IF to_regclass('public.season_schools') IS NULL AND to_regclass('public.teams') IS NOT NULL THEN
    EXECUTE 'CREATE VIEW public.season_schools WITH (security_invoker = true) AS SELECT id, school_id, game_id, season_id, created_at, updated_at FROM public.teams';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_schools TO service_role';
  END IF;
END $$;--> statement-breakpoint

-- 11. roster_standings gains the scope columns (appended, so existing columns keep their positions and old code is
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
