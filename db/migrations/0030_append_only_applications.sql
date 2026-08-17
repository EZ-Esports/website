-- Step 1: Add 'rejected' to PostgreSQL application_status enum
-- NOTE: PostgreSQL requires new enum values to be committed before referencing them in expressions.
ALTER TYPE "public"."application_status" ADD VALUE IF NOT EXISTS 'rejected';
COMMIT;

-- Step 2: Create application_status_logs table
CREATE TABLE IF NOT EXISTS "public"."application_status_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "application_type" text NOT NULL,
  "status" "public"."application_status" NOT NULL,
  "actor_user_id" text,
  "actor_email" text,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "public"."application_status_logs" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "app_status_logs_app_id_idx" ON "public"."application_status_logs" ("application_id");
CREATE INDEX IF NOT EXISTS "app_status_logs_type_id_created_idx" ON "public"."application_status_logs" ("application_type", "application_id", "created_at");
CREATE INDEX IF NOT EXISTS "app_status_logs_created_at_idx" ON "public"."application_status_logs" ("created_at");

-- Step 3: Backfill existing application statuses into application_status_logs
-- Map legacy 'reviewed' status to 'rejected' during backfill
INSERT INTO "public"."application_status_logs" ("id", "application_id", "application_type", "status", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  'school',
  CASE WHEN "status"::text = 'reviewed' THEN 'rejected'::"public"."application_status" ELSE "status" END,
  "submitted_at"
FROM "public"."school_applications" s
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."application_status_logs" l 
  WHERE l."application_id" = s."id" AND l."application_type" = 'school'
);

INSERT INTO "public"."application_status_logs" ("id", "application_id", "application_type", "status", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  'staff',
  CASE WHEN "status"::text = 'reviewed' THEN 'rejected'::"public"."application_status" ELSE "status" END,
  "submitted_at"
FROM "public"."staff_applications" s
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."application_status_logs" l 
  WHERE l."application_id" = s."id" AND l."application_type" = 'staff'
);

-- Step 4: Drop legacy status columns and indexes
DROP INDEX IF EXISTS "public"."school_applications_status_idx";
DROP INDEX IF EXISTS "public"."staff_applications_status_idx";
ALTER TABLE "public"."school_applications" DROP COLUMN IF EXISTS "status";
ALTER TABLE "public"."staff_applications" DROP COLUMN IF EXISTS "status";

-- Step 5: Clean up old auto-generated mutation policies
DROP POLICY IF EXISTS "school_applications_permission_update" ON "public"."school_applications";
DROP POLICY IF EXISTS "school_applications_permission_delete" ON "public"."school_applications";
DROP POLICY IF EXISTS "school_applications_permission_insert" ON "public"."school_applications";
DROP POLICY IF EXISTS "school_applications_permission_select" ON "public"."school_applications";
DROP POLICY IF EXISTS "school_applications_admin_select" ON "public"."school_applications";

DROP POLICY IF EXISTS "staff_applications_permission_update" ON "public"."staff_applications";
DROP POLICY IF EXISTS "staff_applications_permission_delete" ON "public"."staff_applications";
DROP POLICY IF EXISTS "staff_applications_permission_insert" ON "public"."staff_applications";
DROP POLICY IF EXISTS "staff_applications_permission_select" ON "public"."staff_applications";

-- Step 6: Define Public Insert Policies for Application Forms
CREATE POLICY "school_applications_public_insert" ON "public"."school_applications"
  FOR INSERT TO "anon", "authenticated" WITH CHECK (true);

CREATE POLICY "staff_applications_public_insert" ON "public"."staff_applications"
  FOR INSERT TO "anon", "authenticated" WITH CHECK (true);

-- Step 7: Define Staff Select Policies (MANAGE_APPLICATIONS = 512)
CREATE POLICY "school_applications_permission_select" ON "public"."school_applications"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));

CREATE POLICY "staff_applications_permission_select" ON "public"."staff_applications"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));

-- Step 8: Define Status Log Append-Only Policies (MANAGE_APPLICATIONS = 512)
CREATE POLICY "app_status_logs_permission_select" ON "public"."application_status_logs"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));

CREATE POLICY "app_status_logs_permission_insert" ON "public"."application_status_logs"
  FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."has_permission"(512)));
