DO $$ BEGIN
  CREATE TYPE "public"."career_posting_status" AS ENUM('draft', 'published', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "career_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text UNIQUE NOT NULL,
	"department" text NOT NULL,
	"location" text DEFAULT 'Remote (NYC High School League)' NOT NULL,
	"commitment" text DEFAULT '5–10 hours / week' NOT NULL,
	"employment_type" text DEFAULT 'Volunteer / High School Internship' NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"status" "career_posting_status" DEFAULT 'published' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "career_postings_status_idx" ON "career_postings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "career_postings_display_order_idx" ON "career_postings" USING btree ("display_order");
--> statement-breakpoint
ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "career_posting_id" uuid REFERENCES "career_postings"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_applications_career_posting_id_idx" ON "staff_applications" USING btree ("career_posting_id");
