CREATE TABLE "staff_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"preferred_first_name" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"discord_tag" text,
	"role" text NOT NULL,
	"message" text DEFAULT '',
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "staff_applications_status_idx" ON "staff_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_applications_submitted_at_idx" ON "staff_applications" USING btree ("submitted_at");