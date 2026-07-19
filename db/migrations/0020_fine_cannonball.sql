CREATE TABLE "staff_revocations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"revoked_by" uuid NOT NULL,
	"reason" text,
	"revoked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_revocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_revocations_email_unique_idx" ON "staff_revocations" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "staff_revocations_revoked_by_idx" ON "staff_revocations" USING btree ("revoked_by");--> statement-breakpoint
CREATE INDEX "staff_revocations_revoked_at_idx" ON "staff_revocations" USING btree ("revoked_at");
--> statement-breakpoint

-- Tombstones are security state, not ordinary staff-managed records. Portal
-- role managers may inspect them, but no authenticated REST policy permits
-- insertion, modification, or deletion. Trusted server/database operations
-- own those transitions so a revoked identity cannot remove its own marker.
CREATE POLICY "staff_revocations_manage_select" ON "public"."staff_revocations"
FOR SELECT TO "authenticated"
USING ((SELECT "public"."has_permission"(2)));
--> statement-breakpoint
GRANT SELECT ON "public"."staff_revocations" TO "authenticated", "service_role";
--> statement-breakpoint

COMMENT ON TABLE "public"."staff_revocations" IS
'Durable staff access revocations. Clear only through an explicit trusted restoration workflow.';
--> statement-breakpoint

-- A tombstone remains authoritative even if a racing/stale workflow manages
-- to leave a staff_members row behind. Match by both identity and normalized
-- email so recreating the Supabase user cannot bypass a prior revocation.
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
        AND NOT EXISTS (
          SELECT 1
          FROM "public"."staff_revocations" sr
          WHERE sr."user_id" = sm."user_id"
             OR lower(sr."email") = lower(sm."email")
             OR lower(sr."email") = lower(COALESCE((SELECT "auth"."jwt"() ->> 'email'), ''))
        )
    );
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_staff"() TO "anon", "authenticated", "service_role";
--> statement-breakpoint

COMMENT ON FUNCTION "public"."is_staff"() IS
'True for authenticated, non-revoked portal members, independent of assigned roles.';
