-- RLS policies for people
CREATE POLICY "people_public_or_permission_select" ON "public"."people"
FOR SELECT TO "anon", "authenticated"
USING (("is_active" = true AND "deleted_at" IS NULL) OR (SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "people_permission_insert" ON "public"."people"
FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "people_permission_update" ON "public"."people"
FOR UPDATE TO "authenticated"
USING ((SELECT "public"."has_permission"(64)))
WITH CHECK ((SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "people_permission_delete" ON "public"."people"
FOR DELETE TO "authenticated"
USING ((SELECT "public"."has_permission"(64)));
--> statement-breakpoint

-- RLS policies for leadership_terms
CREATE POLICY "leadership_terms_public_or_permission_select" ON "public"."leadership_terms"
FOR SELECT TO "anon", "authenticated"
USING ("deleted_at" IS NULL OR (SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "leadership_terms_permission_insert" ON "public"."leadership_terms"
FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "leadership_terms_permission_update" ON "public"."leadership_terms"
FOR UPDATE TO "authenticated"
USING ((SELECT "public"."has_permission"(64)))
WITH CHECK ((SELECT "public"."has_permission"(64)));
--> statement-breakpoint
CREATE POLICY "leadership_terms_permission_delete" ON "public"."leadership_terms"
FOR DELETE TO "authenticated"
USING ((SELECT "public"."has_permission"(64)));
--> statement-breakpoint

GRANT SELECT ON "public"."people" TO "anon", "authenticated", "service_role";
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON "public"."people" TO "authenticated", "service_role";
--> statement-breakpoint
GRANT SELECT ON "public"."leadership_terms" TO "anon", "authenticated", "service_role";
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON "public"."leadership_terms" TO "authenticated", "service_role";
