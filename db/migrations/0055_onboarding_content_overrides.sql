CREATE TABLE IF NOT EXISTS "onboarding_content_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"field" text NOT NULL,
	"submitted_value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"review_note" text
);--> statement-breakpoint
ALTER TABLE "onboarding_content_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "onboarding_content_overrides" ADD CONSTRAINT "onboarding_content_overrides_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_content_overrides_member_id_idx" ON "onboarding_content_overrides" USING btree ("member_id");
