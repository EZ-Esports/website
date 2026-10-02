CREATE TABLE "player_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"provider_username" text NOT NULL,
	"in_guild" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "player_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"intended_first_name" text NOT NULL,
	"intended_last_name" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "player_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "school_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"managed_games" text[],
	"academic_year" text NOT NULL,
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "school_managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_demographics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"legal_first_name" text NOT NULL,
	"legal_last_name" text NOT NULL,
	"birth_date" timestamp NOT NULL,
	"gender" text,
	"race" text[],
	"ethnicity" text[],
	"country_of_birth" text,
	"parents_country_of_birth" text,
	"primary_language_at_home" text,
	"is_free_or_reduced_lunch" boolean,
	"is_first_gen_college" boolean,
	"doe_petition_consent" boolean DEFAULT false NOT NULL,
	"survey_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_demographics_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "student_demographics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_identities" ADD CONSTRAINT "player_identities_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invites" ADD CONSTRAINT "player_invites_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invites" ADD CONSTRAINT "player_invites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_managers" ADD CONSTRAINT "school_managers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_demographics" ADD CONSTRAINT "student_demographics_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_identities_provider_user_idx" ON "player_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "player_identities_member_id_idx" ON "player_identities" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "player_invites_school_game_idx" ON "player_invites" USING btree ("school_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_invites_token_hash_idx" ON "player_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "school_managers_school_user_year_idx" ON "school_managers" USING btree ("school_id","user_id","academic_year");--> statement-breakpoint
CREATE INDEX "school_managers_user_id_idx" ON "school_managers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_demographics_member_id_idx" ON "student_demographics" USING btree ("member_id");