CREATE TABLE "staff_revocations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"revoked_by" uuid NOT NULL,
	"reason" text,
	"revoked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_revocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_revocations_email_unique_idx" ON "staff_revocations" USING btree ("email");--> statement-breakpoint
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
