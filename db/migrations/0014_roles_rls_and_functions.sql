-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION "public"."is_super_admin"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."user_roles" ur
    JOIN "public"."roles" r ON ur."role_id" = r."id"
    WHERE ur."user_id" = (SELECT "auth"."uid"())
      AND (r."is_owner" = true OR (r."permissions" & 3) != 0)
  );
$$;
--> statement-breakpoint

CREATE POLICY "roles_admin_select" ON "public"."roles"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));
--> statement-breakpoint

CREATE POLICY "roles_super_admin_insert" ON "public"."roles"
  FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "roles_super_admin_update" ON "public"."roles"
  FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_super_admin"())) WITH CHECK ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "roles_super_admin_delete" ON "public"."roles"
  FOR DELETE TO "authenticated" USING ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "user_roles_admin_select" ON "public"."user_roles"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));
--> statement-breakpoint

CREATE POLICY "user_roles_super_admin_insert" ON "public"."user_roles"
  FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "user_roles_super_admin_update" ON "public"."user_roles"
  FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_super_admin"())) WITH CHECK ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "user_roles_super_admin_delete" ON "public"."user_roles"
  FOR DELETE TO "authenticated" USING ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "admin_invite_roles_super_admin_select" ON "public"."admin_invite_roles"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "admin_invite_roles_super_admin_insert" ON "public"."admin_invite_roles"
  FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "admin_invite_roles_super_admin_update" ON "public"."admin_invite_roles"
  FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_super_admin"())) WITH CHECK ((SELECT "public"."is_super_admin"()));
--> statement-breakpoint

CREATE POLICY "admin_invite_roles_super_admin_delete" ON "public"."admin_invite_roles"
  FOR DELETE TO "authenticated" USING ((SELECT "public"."is_super_admin"()));