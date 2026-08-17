CREATE TABLE "application_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"application_type" text NOT NULL,
	"status" "application_status" NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_status_logs_type_check" CHECK ("application_type" IN ('school', 'staff'))
);
--> statement-breakpoint
ALTER TABLE "application_status_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX "app_status_logs_app_id_idx" ON "application_status_logs" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "app_status_logs_type_id_created_idx" ON "application_status_logs" USING btree ("application_type","application_id","created_at");
--> statement-breakpoint
CREATE INDEX "app_status_logs_created_at_idx" ON "application_status_logs" USING btree ("created_at");
--> statement-breakpoint
-- Backfill existing school_applications statuses into application_status_logs 1:1 (preserving 'reviewed' as 'reviewed')
INSERT INTO "application_status_logs" ("id", "application_id", "application_type", "status", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  'school',
  "status",
  "submitted_at"
FROM "school_applications" s
WHERE NOT EXISTS (
  SELECT 1 FROM "application_status_logs" l 
  WHERE l."application_id" = s."id" AND l."application_type" = 'school'
);
--> statement-breakpoint
-- Backfill existing staff_applications statuses into application_status_logs 1:1 (preserving 'reviewed' as 'reviewed')
INSERT INTO "application_status_logs" ("id", "application_id", "application_type", "status", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  'staff',
  "status",
  "submitted_at"
FROM "staff_applications" s
WHERE NOT EXISTS (
  SELECT 1 FROM "application_status_logs" l 
  WHERE l."application_id" = s."id" AND l."application_type" = 'staff'
);
--> statement-breakpoint
DROP INDEX IF EXISTS "school_applications_status_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "staff_applications_status_idx";
--> statement-breakpoint
ALTER TABLE "school_applications" DROP COLUMN IF EXISTS "status";
--> statement-breakpoint
ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "status";
--> statement-breakpoint
-- Drop legacy mutation RLS policies
DROP POLICY IF EXISTS "school_applications_permission_update" ON "school_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "school_applications_permission_delete" ON "school_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "school_applications_permission_insert" ON "school_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "school_applications_permission_select" ON "school_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "school_applications_admin_select" ON "school_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "staff_applications_permission_update" ON "staff_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "staff_applications_permission_delete" ON "staff_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "staff_applications_permission_insert" ON "staff_applications";
--> statement-breakpoint
DROP POLICY IF EXISTS "staff_applications_permission_select" ON "staff_applications";
--> statement-breakpoint
-- Define Staff Select Policies (MANAGE_APPLICATIONS = 512)
CREATE POLICY "school_applications_permission_select" ON "school_applications"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
CREATE POLICY "staff_applications_permission_select" ON "staff_applications"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
-- Define Status Log Append-Only Policies (MANAGE_APPLICATIONS = 512)
CREATE POLICY "app_status_logs_permission_select" ON "application_status_logs"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
CREATE POLICY "app_status_logs_permission_insert" ON "application_status_logs"
  FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
-- PostgreSQL BEFORE UPDATE OR DELETE triggers to enforce immutability at the DB engine level for all connection roles
CREATE OR REPLACE FUNCTION prevent_application_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable: UPDATE and DELETE operations are prohibited', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER prevent_school_applications_mutation
BEFORE UPDATE OR DELETE ON "school_applications"
FOR EACH ROW EXECUTE FUNCTION prevent_application_mutation();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER prevent_staff_applications_mutation
BEFORE UPDATE OR DELETE ON "staff_applications"
FOR EACH ROW EXECUTE FUNCTION prevent_application_mutation();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER prevent_application_status_logs_mutation
BEFORE UPDATE OR DELETE ON "application_status_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_application_mutation();
