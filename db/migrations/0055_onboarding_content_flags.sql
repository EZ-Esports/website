CREATE TABLE IF NOT EXISTS "onboarding_content_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"school_id" uuid,
	"invite_kind" text NOT NULL,
	"invite_id" uuid NOT NULL,
	"flagged_fields" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	CONSTRAINT "onboarding_content_flags_invite_kind_check" CHECK ("onboarding_content_flags"."invite_kind" in ('player', 'manager'))
);--> statement-breakpoint
ALTER TABLE "onboarding_content_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "onboarding_content_flags" ADD CONSTRAINT "onboarding_content_flags_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "onboarding_content_flags" ADD CONSTRAINT "onboarding_content_flags_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_content_flags_invite_idx" ON "onboarding_content_flags" USING btree ("invite_kind","invite_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_content_flags_member_id_idx" ON "onboarding_content_flags" USING btree ("member_id");
