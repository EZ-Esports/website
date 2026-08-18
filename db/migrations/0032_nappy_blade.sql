CREATE TABLE "leadership_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"year" text NOT NULL,
	"role" text NOT NULL,
	"department" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"term_bio" text,
	"deleted_at" timestamp,
	"deleted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leadership_terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"preferred_name" text,
	"handle" text,
	"avatar_url" text,
	"storage_key" text,
	"high_school" text,
	"university" text,
	"graduation_year" integer,
	"bio" text,
	"email" text,
	"discord" text,
	"user_id" uuid,
	"member_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_staff_members_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_members"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leadership_terms_year_idx" ON "leadership_terms" USING btree ("year");--> statement-breakpoint
CREATE INDEX "leadership_terms_person_id_idx" ON "leadership_terms" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leadership_terms_person_year_role_idx" ON "leadership_terms" USING btree ("person_id","year","role") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "people_full_name_idx" ON "people" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "people_handle_idx" ON "people" USING btree ("handle");