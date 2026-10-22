ALTER TABLE "seasons" ADD COLUMN IF NOT EXISTS "outcomes_finalized_at" timestamp;
--> statement-breakpoint
UPDATE "seasons" SET "outcomes_finalized_at" = now() WHERE "is_active" = false AND "outcomes_finalized_at" IS NULL;
