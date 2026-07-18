CREATE TABLE "staff_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"user_id" uuid,
	"email" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_invite_roles" RENAME TO "staff_invite_roles";--> statement-breakpoint
ALTER TABLE "admin_invites" RENAME TO "staff_invites";--> statement-breakpoint
ALTER TABLE "admin_users" RENAME TO "staff_members";--> statement-breakpoint
ALTER INDEX IF EXISTS "admin_invite_roles_role_id_idx" RENAME TO "staff_invite_roles_role_id_idx";--> statement-breakpoint
ALTER TABLE "staff_invites" DROP CONSTRAINT "admin_invites_token_hash_unique";--> statement-breakpoint
ALTER TABLE "staff_members" DROP CONSTRAINT "admin_users_email_unique";--> statement-breakpoint
ALTER TABLE "staff_invite_roles" DROP CONSTRAINT "admin_invite_roles_invite_id_admin_invites_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_invite_roles" DROP CONSTRAINT "admin_invite_roles_role_id_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_admin_users_user_id_fk";
--> statement-breakpoint
DROP INDEX "admin_invites_email_idx";--> statement-breakpoint
DROP INDEX "admin_invites_email_pending_unique";--> statement-breakpoint
DROP INDEX "admin_users_email_idx";--> statement-breakpoint
ALTER TABLE "staff_invite_roles" DROP CONSTRAINT "admin_invite_roles_invite_id_role_id_pk";--> statement-breakpoint
ALTER TABLE "staff_invite_roles" ADD CONSTRAINT "staff_invite_roles_invite_id_role_id_pk" PRIMARY KEY("invite_id","role_id");--> statement-breakpoint
CREATE INDEX "staff_audit_logs_created_at_idx" ON "staff_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "staff_audit_logs_user_id_idx" ON "staff_audit_logs" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "staff_invite_roles" ADD CONSTRAINT "staff_invite_roles_invite_id_staff_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."staff_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite_roles" ADD CONSTRAINT "staff_invite_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_staff_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_members"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_invites_email_idx" ON "staff_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invites_email_pending_unique" ON "staff_invites" USING btree ("email") WHERE "staff_invites"."accepted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_members_email_idx" ON "staff_members" USING btree ("email");--> statement-breakpoint
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_token_hash_unique" UNIQUE("token_hash");--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_email_unique" UNIQUE("email");
--> statement-breakpoint

-- Remove every policy that still delegates to the old membership-only helpers.
-- Policies that are genuinely public (games/page content/standings) are retained.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') LIKE '%is_admin%'
        OR COALESCE(qual, '') LIKE '%is_super_admin%'
        OR COALESCE(with_check, '') LIKE '%is_admin%'
        OR COALESCE(with_check, '') LIKE '%is_super_admin%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END $$;
--> statement-breakpoint

DROP FUNCTION IF EXISTS "public"."is_super_admin"();
--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."is_admin"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."is_staff"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT "auth"."uid"()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "public"."staff_members" sm
      WHERE sm."user_id" = (SELECT "auth"."uid"())
    );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."has_permission"(required_permission bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH effective_roles AS (
    SELECT r."permissions", r."is_owner"
    FROM "public"."roles" r
    WHERE r."name" = '@everyone'
       OR EXISTS (
         SELECT 1
         FROM "public"."user_roles" ur
         WHERE ur."user_id" = (SELECT "auth"."uid"())
           AND ur."role_id" = r."id"
       )
  )
  SELECT (SELECT "public"."is_staff"())
    AND COALESCE(
      bool_or(
        "is_owner"
        OR ("permissions" & 1) <> 0
        OR ("permissions" & required_permission) <> 0
      ),
      false
    )
  FROM effective_roles;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."has_permission"(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."has_permission"(bigint) TO "anon", "authenticated", "service_role";
--> statement-breakpoint

COMMENT ON FUNCTION "public"."is_staff"() IS 'True for authenticated portal members, independent of assigned roles.';
COMMENT ON FUNCTION "public"."has_permission"(bigint) IS 'Discord-style effective permission check including @everyone, Owner, and ADMINISTRATOR.';
--> statement-breakpoint

-- Public rows remain public; non-public rows require the capability used by
-- the corresponding application section.
CREATE POLICY "schools_public_or_permission_select" ON "public"."schools"
FOR SELECT TO "anon", "authenticated"
USING (
  ("is_active" = true AND "deleted_at" IS NULL)
  OR (SELECT "public"."has_permission"(1564))
);
--> statement-breakpoint
CREATE POLICY "seasons_public_or_permission_select" ON "public"."seasons"
FOR SELECT TO "anon", "authenticated"
USING ("is_active" = true OR (SELECT "public"."has_permission"(28)));
--> statement-breakpoint
CREATE POLICY "teams_public_or_permission_select" ON "public"."teams"
FOR SELECT TO "anon", "authenticated"
USING (
  (SELECT "public"."has_permission"(28))
  OR (
    EXISTS (
      SELECT 1 FROM "public"."schools" s
      WHERE s."id" = "teams"."school_id"
        AND s."is_active" = true AND s."deleted_at" IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM "public"."seasons" se
      WHERE se."id" = "teams"."season_id" AND se."is_active" = true
    )
  )
);
--> statement-breakpoint
CREATE POLICY "rosters_public_or_permission_select" ON "public"."rosters"
FOR SELECT TO "anon", "authenticated"
USING (
  (SELECT "public"."has_permission"(24))
  OR EXISTS (
    SELECT 1
    FROM "public"."teams" t
    JOIN "public"."schools" s ON s."id" = t."school_id"
    JOIN "public"."seasons" se ON se."id" = t."season_id"
    WHERE t."id" = "rosters"."team_id"
      AND s."is_active" = true AND s."deleted_at" IS NULL
      AND se."is_active" = true
  )
);
--> statement-breakpoint
CREATE POLICY "players_public_or_permission_select" ON "public"."players"
FOR SELECT TO "anon", "authenticated"
USING (
  (SELECT "public"."has_permission"(8))
  OR EXISTS (
    SELECT 1
    FROM "public"."rosters" r
    JOIN "public"."teams" t ON t."id" = r."team_id"
    JOIN "public"."schools" s ON s."id" = t."school_id"
    JOIN "public"."seasons" se ON se."id" = t."season_id"
    WHERE r."id" = "players"."roster_id"
      AND s."is_active" = true AND s."deleted_at" IS NULL
      AND se."is_active" = true
  )
);
--> statement-breakpoint
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
      JOIN "public"."teams" t ON t."id" = r."team_id"
      JOIN "public"."schools" s ON s."id" = t."school_id"
      WHERE r."id" = "matches"."home_roster_id"
        AND t."season_id" = "matches"."season_id"
        AND s."is_active" = true AND s."deleted_at" IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM "public"."rosters" r
      JOIN "public"."teams" t ON t."id" = r."team_id"
      JOIN "public"."schools" s ON s."id" = t."school_id"
      WHERE r."id" = "matches"."away_roster_id"
        AND t."season_id" = "matches"."season_id"
        AND s."is_active" = true AND s."deleted_at" IS NULL
    )
  )
);
--> statement-breakpoint
CREATE POLICY "news_posts_public_or_permission_select" ON "public"."news_posts"
FOR SELECT TO "anon", "authenticated"
USING (("status" = 'published' AND "deleted_at" IS NULL) OR (SELECT "public"."has_permission"(32)));
--> statement-breakpoint
CREATE POLICY "leadership_public_or_permission_select" ON "public"."leadership"
FOR SELECT TO "anon", "authenticated"
USING ("deleted_at" IS NULL OR (SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "gallery_images_public_or_permission_select" ON "public"."gallery_images"
FOR SELECT TO "anon", "authenticated"
USING (("is_active" = true AND "deleted_at" IS NULL) OR (SELECT "public"."has_permission"(128)));
--> statement-breakpoint
CREATE POLICY "sponsors_public_or_permission_select" ON "public"."sponsors"
FOR SELECT TO "anon", "authenticated"
USING (("is_active" = true AND "deleted_at" IS NULL) OR (SELECT "public"."has_permission"(256)));
--> statement-breakpoint
CREATE POLICY "members_rosters_select" ON "public"."members"
FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(8)));
--> statement-breakpoint
CREATE POLICY "school_applications_permission_select" ON "public"."school_applications"
FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
CREATE POLICY "page_content_history_permission_select" ON "public"."page_content_history"
FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(2048)));
--> statement-breakpoint

CREATE POLICY "roles_staff_select" ON "public"."roles"
FOR SELECT TO "authenticated" USING ((SELECT "public"."is_staff"()));
CREATE POLICY "staff_members_self_or_roles_select" ON "public"."staff_members"
FOR SELECT TO "authenticated"
USING ("user_id" = (SELECT "auth"."uid"()) OR (SELECT "public"."has_permission"(2)));
CREATE POLICY "user_roles_self_or_roles_select" ON "public"."user_roles"
FOR SELECT TO "authenticated"
USING ("user_id" = (SELECT "auth"."uid"()) OR (SELECT "public"."has_permission"(2)));
CREATE POLICY "staff_invites_roles_select" ON "public"."staff_invites"
FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(2)));
CREATE POLICY "staff_invite_roles_roles_select" ON "public"."staff_invite_roles"
FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(2)));
CREATE POLICY "staff_audit_logs_roles_select" ON "public"."staff_audit_logs"
FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(2)));
GRANT SELECT ON "public"."staff_audit_logs" TO "authenticated", "service_role";
--> statement-breakpoint

-- Table-specific mutation capabilities. Multiple bits in a value mean any of
-- those bits is accepted by has_permission().
--
-- Membership-domain writes (roles, user_roles, staff_members, staff_invites,
-- and staff_invite_roles) intentionally have no authenticated mutation
-- policies. Those writes must use the trusted DATABASE_URL connection so the
-- application-layer role hierarchy and MANAGE_ROLES checks cannot be bypassed
-- through direct Supabase REST/table DML.
DO $$
DECLARE
  permission_row record;
BEGIN
  FOR permission_row IN
    SELECT * FROM (VALUES
      ('games', 4::bigint),
      ('seasons', 4::bigint),
      ('teams', 12::bigint),
      ('members', 8::bigint),
      ('rosters', 8::bigint),
      ('players', 8::bigint),
      ('matches', 16::bigint),
      ('season_standings', 16::bigint),
      ('news_posts', 32::bigint),
      ('leadership', 64::bigint),
      ('gallery_images', 128::bigint),
      ('sponsors', 256::bigint),
      ('school_applications', 512::bigint),
      ('schools', 1024::bigint),
      ('page_content', 2048::bigint),
      ('page_content_history', 2048::bigint)
    ) AS mappings(table_name, permission_mask)
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON "public".%I FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."has_permission"(%s)))',
      permission_row.table_name || '_permission_insert',
      permission_row.table_name,
      permission_row.permission_mask
    );
    EXECUTE format(
      'CREATE POLICY %I ON "public".%I FOR UPDATE TO "authenticated" USING ((SELECT "public"."has_permission"(%s))) WITH CHECK ((SELECT "public"."has_permission"(%s)))',
      permission_row.table_name || '_permission_update',
      permission_row.table_name,
      permission_row.permission_mask,
      permission_row.permission_mask
    );
    EXECUTE format(
      'CREATE POLICY %I ON "public".%I FOR DELETE TO "authenticated" USING ((SELECT "public"."has_permission"(%s)))',
      permission_row.table_name || '_permission_delete',
      permission_row.table_name,
      permission_row.permission_mask
    );
  END LOOP;
END $$;
