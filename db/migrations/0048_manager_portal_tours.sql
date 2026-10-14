CREATE TABLE IF NOT EXISTS "manager_portal_tours" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manager_portal_tours" ENABLE ROW LEVEL SECURITY;
