-- spec-056: school (nycstudents.net) email and student ID photo for onboarding.
--
-- Hand-written like 0043 onward: the drizzle-kit snapshot chain stops at 0042, so `db:generate` refuses to run.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the code. New code reads and writes these
-- columns on every onboarding submission. Nothing has been onboarded yet, so there is no backfill.
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "school_email" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_school_email_lower_idx" ON "members" USING btree (lower("school_email"));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_id_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_kind" text NOT NULL,
	"invite_id" uuid NOT NULL,
	"member_id" uuid,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_id_uploads_invite_kind_check" CHECK ("student_id_uploads"."invite_kind" in ('player', 'manager'))
);--> statement-breakpoint
ALTER TABLE "student_id_uploads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "student_id_uploads" ADD CONSTRAINT "student_id_uploads_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
-- SET NULL (not cascade): the row is the only pointer to the stored photo, so deleting a member leaves it
-- behind for the application's sweep to remove the object first and the row second.
CREATE UNIQUE INDEX IF NOT EXISTS "student_id_uploads_invite_idx" ON "student_id_uploads" USING btree ("invite_kind","invite_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_id_uploads_member_idx" ON "student_id_uploads" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_id_uploads_storage_key_idx" ON "student_id_uploads" USING btree ("storage_key");--> statement-breakpoint
-- Private Storage bucket for the ID photos. public = false and NO storage.objects policies: with row
-- level security on and no policy, anon and authenticated roles can neither list nor read it; only the
-- service role (server code) can. Safe to re-run: an existing bucket is forced back to private.
-- Two cases are tolerated so the column and table above still apply: no `storage` schema at all
-- (PGlite, plain Postgres), and a migration role that may not write it (insufficient_privilege, which
-- only RAISES A NOTICE). In the second case the bucket is NOT created: create it by hand before deploying
-- (Dashboard > Storage > New bucket "student-ids", Public OFF, 5 MB limit, image/jpeg, image/png, image/webp).
DO $$ BEGIN
	IF to_regclass('storage.buckets') IS NOT NULL THEN
		BEGIN
			INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
			VALUES ('student-ids', 'student-ids', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
			ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
				allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
		EXCEPTION WHEN insufficient_privilege THEN
			RAISE NOTICE 'student-ids bucket NOT created (insufficient privilege on storage.buckets): create it by hand as a private bucket before deploying.';
		END;
	END IF;
END $$;
