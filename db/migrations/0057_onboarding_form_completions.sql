-- spec-051: the in-app demographics survey is replaced by a staff-configured Google Form.
--
-- DEPLOY ORDER: deploy the application code first, then apply this migration. Old code writes
-- to student_demographics on every onboarding submission, so dropping it before the new code is
-- live breaks onboarding.
--
-- DATA LOSS: the DROP below permanently deletes student_demographics, which holds student PII.
-- The owner confirmed that data is disposable. Take a backup first if there is any doubt.
CREATE TABLE IF NOT EXISTS "onboarding_form_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_kind" text NOT NULL,
	"invite_id" uuid NOT NULL,
	"member_id" uuid,
	"source" text DEFAULT 'google_form' NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_form_completions_invite_kind_check" CHECK ("onboarding_form_completions"."invite_kind" in ('player', 'manager')),
	CONSTRAINT "onboarding_form_completions_source_check" CHECK ("onboarding_form_completions"."source" in ('google_form', 'manual'))
);--> statement-breakpoint
ALTER TABLE "onboarding_form_completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "onboarding_form_completions" ADD CONSTRAINT "onboarding_form_completions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_form_completions_invite_idx" ON "onboarding_form_completions" USING btree ("invite_kind","invite_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_form_completions_member_id_idx" ON "onboarding_form_completions" USING btree ("member_id");--> statement-breakpoint
DROP TABLE IF EXISTS "student_demographics";
