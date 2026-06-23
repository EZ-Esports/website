ALTER TABLE "admin_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gallery_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leadership" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "news_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "page_content" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "page_content_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rosters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "school_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sponsors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER VIEW "public"."roster_standings" SET (security_invoker = true);--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."is_admin"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."admin_users"
    WHERE "user_id" = (SELECT "auth"."uid"())
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."is_super_admin"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."admin_users"
    WHERE "user_id" = (SELECT "auth"."uid"())
      AND "role" = 'super_admin'
  );
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."is_super_admin"() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "anon", "authenticated", "service_role";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_super_admin"() TO "anon", "authenticated", "service_role";--> statement-breakpoint

CREATE POLICY "games_public_select"
ON "public"."games"
FOR SELECT
TO "anon", "authenticated"
USING (true);--> statement-breakpoint

CREATE POLICY "schools_public_select"
ON "public"."schools"
FOR SELECT
TO "anon", "authenticated"
USING (("is_active" = true AND "deleted_at" IS NULL) OR (SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "seasons_public_select"
ON "public"."seasons"
FOR SELECT
TO "anon", "authenticated"
USING (("is_active" = true) OR (SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "teams_public_select"
ON "public"."teams"
FOR SELECT
TO "anon", "authenticated"
USING (
  (SELECT "public"."is_admin"())
  OR (
    EXISTS (
      SELECT 1
      FROM "public"."schools" "s"
      WHERE "s"."id" = "teams"."school_id"
        AND "s"."is_active" = true
        AND "s"."deleted_at" IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."seasons" "se"
      WHERE "se"."id" = "teams"."season_id"
        AND "se"."is_active" = true
    )
  )
);--> statement-breakpoint

CREATE POLICY "rosters_public_select"
ON "public"."rosters"
FOR SELECT
TO "anon", "authenticated"
USING (
  (SELECT "public"."is_admin"())
  OR EXISTS (
    SELECT 1
    FROM "public"."teams" "t"
    JOIN "public"."schools" "s" ON "s"."id" = "t"."school_id"
    JOIN "public"."seasons" "se" ON "se"."id" = "t"."season_id"
    WHERE "t"."id" = "rosters"."team_id"
      AND "s"."is_active" = true
      AND "s"."deleted_at" IS NULL
      AND "se"."is_active" = true
  )
);--> statement-breakpoint

CREATE POLICY "players_public_select"
ON "public"."players"
FOR SELECT
TO "anon", "authenticated"
USING (
  (SELECT "public"."is_admin"())
  OR EXISTS (
    SELECT 1
    FROM "public"."rosters" "r"
    JOIN "public"."teams" "t" ON "t"."id" = "r"."team_id"
    JOIN "public"."schools" "s" ON "s"."id" = "t"."school_id"
    JOIN "public"."seasons" "se" ON "se"."id" = "t"."season_id"
    WHERE "r"."id" = "players"."roster_id"
      AND "s"."is_active" = true
      AND "s"."deleted_at" IS NULL
      AND "se"."is_active" = true
  )
);--> statement-breakpoint

CREATE POLICY "matches_public_select"
ON "public"."matches"
FOR SELECT
TO "anon", "authenticated"
USING (
  (SELECT "public"."is_admin"())
  OR (
    EXISTS (
      SELECT 1
      FROM "public"."seasons" "se"
      WHERE "se"."id" = "matches"."season_id"
        AND "se"."is_active" = true
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."rosters" "r"
      JOIN "public"."teams" "t" ON "t"."id" = "r"."team_id"
      JOIN "public"."schools" "s" ON "s"."id" = "t"."school_id"
      WHERE "r"."id" = "matches"."home_roster_id"
        AND "t"."season_id" = "matches"."season_id"
        AND "s"."is_active" = true
        AND "s"."deleted_at" IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."rosters" "r"
      JOIN "public"."teams" "t" ON "t"."id" = "r"."team_id"
      JOIN "public"."schools" "s" ON "s"."id" = "t"."school_id"
      WHERE "r"."id" = "matches"."away_roster_id"
        AND "t"."season_id" = "matches"."season_id"
        AND "s"."is_active" = true
        AND "s"."deleted_at" IS NULL
    )
  )
);--> statement-breakpoint

CREATE POLICY "news_posts_public_select"
ON "public"."news_posts"
FOR SELECT
TO "anon", "authenticated"
USING (("status" = 'published' AND "deleted_at" IS NULL) OR (SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "leadership_public_select"
ON "public"."leadership"
FOR SELECT
TO "anon", "authenticated"
USING (("deleted_at" IS NULL) OR (SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "gallery_images_public_select"
ON "public"."gallery_images"
FOR SELECT
TO "anon", "authenticated"
USING (("is_active" = true AND "deleted_at" IS NULL) OR (SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "sponsors_public_select"
ON "public"."sponsors"
FOR SELECT
TO "anon", "authenticated"
USING (("is_active" = true AND "deleted_at" IS NULL) OR (SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "page_content_public_select"
ON "public"."page_content"
FOR SELECT
TO "anon", "authenticated"
USING (true);--> statement-breakpoint

CREATE POLICY "members_admin_select"
ON "public"."members"
FOR SELECT
TO "authenticated"
USING ((SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "school_applications_admin_select"
ON "public"."school_applications"
FOR SELECT
TO "authenticated"
USING ((SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "page_content_history_admin_select"
ON "public"."page_content_history"
FOR SELECT
TO "authenticated"
USING ((SELECT "public"."is_admin"()));--> statement-breakpoint

CREATE POLICY "admin_users_select"
ON "public"."admin_users"
FOR SELECT
TO "authenticated"
USING ("user_id" = (SELECT "auth"."uid"()) OR (SELECT "public"."is_super_admin"()));--> statement-breakpoint

CREATE POLICY "admin_invites_super_admin_select"
ON "public"."admin_invites"
FOR SELECT
TO "authenticated"
USING ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'gallery_images',
    'games',
    'leadership',
    'matches',
    'members',
    'news_posts',
    'page_content',
    'page_content_history',
    'players',
    'rosters',
    'school_applications',
    'schools',
    'seasons',
    'sponsors',
    'teams'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON "public".%I FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()))',
      target_table || '_admin_insert',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON "public".%I FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()))',
      target_table || '_admin_update',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON "public".%I FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()))',
      target_table || '_admin_delete',
      target_table
    );
  END LOOP;
END $$;--> statement-breakpoint

CREATE POLICY "admin_users_super_admin_insert"
ON "public"."admin_users"
FOR INSERT
TO "authenticated"
WITH CHECK ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

CREATE POLICY "admin_users_super_admin_update"
ON "public"."admin_users"
FOR UPDATE
TO "authenticated"
USING ((SELECT "public"."is_super_admin"()))
WITH CHECK ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

CREATE POLICY "admin_users_super_admin_delete"
ON "public"."admin_users"
FOR DELETE
TO "authenticated"
USING ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

CREATE POLICY "admin_invites_super_admin_insert"
ON "public"."admin_invites"
FOR INSERT
TO "authenticated"
WITH CHECK ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

CREATE POLICY "admin_invites_super_admin_update"
ON "public"."admin_invites"
FOR UPDATE
TO "authenticated"
USING ((SELECT "public"."is_super_admin"()))
WITH CHECK ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

CREATE POLICY "admin_invites_super_admin_delete"
ON "public"."admin_invites"
FOR DELETE
TO "authenticated"
USING ((SELECT "public"."is_super_admin"()));--> statement-breakpoint

GRANT SELECT ON "public"."roster_standings" TO "anon", "authenticated";
