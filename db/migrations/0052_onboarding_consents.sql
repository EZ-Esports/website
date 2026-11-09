CREATE TABLE IF NOT EXISTS "onboarding_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"school_id" uuid,
	"invite_kind" text NOT NULL,
	"invite_id" uuid NOT NULL,
	"form_version" text NOT NULL,
	"is_minor" boolean NOT NULL,
	"age_at_signing" integer NOT NULL,
	"tos_acknowledged" boolean NOT NULL,
	"participant_legal_name" text NOT NULL,
	"guardian_full_name" text,
	"guardian_relationship" text,
	"guardian_email" text,
	"guardian_signature" text,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_consents_invite_kind_check" CHECK ("onboarding_consents"."invite_kind" in ('player', 'manager')),
	CONSTRAINT "onboarding_consents_tos_check" CHECK ("onboarding_consents"."tos_acknowledged" = true),
	CONSTRAINT "onboarding_consents_minor_guardian_check" CHECK (not "onboarding_consents"."is_minor" or ("onboarding_consents"."guardian_full_name" is not null and "onboarding_consents"."guardian_relationship" is not null and "onboarding_consents"."guardian_email" is not null and "onboarding_consents"."guardian_signature" is not null))
);--> statement-breakpoint
ALTER TABLE "onboarding_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "onboarding_consents" ADD CONSTRAINT "onboarding_consents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_consents" ADD CONSTRAINT "onboarding_consents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_consents_invite_idx" ON "onboarding_consents" USING btree ("invite_kind","invite_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_consents_member_id_idx" ON "onboarding_consents" USING btree ("member_id");
