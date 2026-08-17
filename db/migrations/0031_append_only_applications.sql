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
-- Backfill existing school_applications into application_status_logs with status 'pending'
INSERT INTO "application_status_logs" ("id", "application_id", "application_type", "status", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  'school',
  CASE WHEN s."status"::text = 'accepted' THEN 'accepted'::"public"."application_status" ELSE 'pending'::"public"."application_status" END,
  "submitted_at"
FROM "school_applications" s
WHERE NOT EXISTS (
  SELECT 1 FROM "application_status_logs" l 
  WHERE l."application_id" = s."id" AND l."application_type" = 'school'
);
--> statement-breakpoint
-- Backfill existing staff_applications into application_status_logs with status 'pending'
INSERT INTO "application_status_logs" ("id", "application_id", "application_type", "status", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  'staff',
  CASE WHEN s."status"::text = 'accepted' THEN 'accepted'::"public"."application_status" ELSE 'pending'::"public"."application_status" END,
  "submitted_at"
FROM "staff_applications" s
WHERE NOT EXISTS (
  SELECT 1 FROM "application_status_logs" l 
  WHERE l."application_id" = s."id" AND l."application_type" = 'staff'
);
--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN IF NOT EXISTS "deleted_by" text;
--> statement-breakpoint
ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "deleted_by" text;
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
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Table % is immutable: DELETE operations are prohibited', TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'application_status_logs' THEN
      RAISE EXCEPTION 'Table application_status_logs is immutable: UPDATE operations are prohibited';
    ELSIF TG_TABLE_NAME = 'school_applications' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR
         NEW.applicant_name IS DISTINCT FROM OLD.applicant_name OR
         NEW.school_name IS DISTINCT FROM OLD.school_name OR
         NEW.role IS DISTINCT FROM OLD.role OR
         NEW.email IS DISTINCT FROM OLD.email OR
         NEW.message IS DISTINCT FROM OLD.message OR
         NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'School application submission fields are immutable';
      END IF;
    ELSIF TG_TABLE_NAME = 'staff_applications' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR
         NEW.name IS DISTINCT FROM OLD.name OR
         NEW.preferred_first_name IS DISTINCT FROM OLD.preferred_first_name OR
         NEW.email IS DISTINCT FROM OLD.email OR
         NEW.phone IS DISTINCT FROM OLD.phone OR
         NEW.discord_tag IS DISTINCT FROM OLD.discord_tag OR
         NEW.role IS DISTINCT FROM OLD.role OR
         NEW.message IS DISTINCT FROM OLD.message OR
         NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Staff application submission fields are immutable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
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
