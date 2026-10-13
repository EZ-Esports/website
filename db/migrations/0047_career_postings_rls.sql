ALTER TABLE "career_postings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "career_postings_public_or_permission_select" ON "public"."career_postings"
FOR SELECT TO "anon", "authenticated"
USING (("status" = 'published' AND "deleted_at" IS NULL) OR (SELECT "public"."has_permission"(512)));
--> statement-breakpoint
CREATE POLICY "career_postings_permission_insert" ON "public"."career_postings"
FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
CREATE POLICY "career_postings_permission_update" ON "public"."career_postings"
FOR UPDATE TO "authenticated"
USING ((SELECT "public"."has_permission"(512)))
WITH CHECK ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
CREATE POLICY "career_postings_permission_delete" ON "public"."career_postings"
FOR DELETE TO "authenticated"
USING ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
GRANT SELECT ON "public"."career_postings" TO "anon", "authenticated", "service_role";
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON "public"."career_postings" TO "authenticated", "service_role";
