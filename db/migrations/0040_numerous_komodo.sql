ALTER TABLE "matches" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "round_name" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "round_order" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_order" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "bracket_group" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "home_participant_name" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "away_participant_name" text;--> statement-breakpoint
CREATE INDEX "matches_stage_idx" ON "matches" USING btree ("stage");--> statement-breakpoint
UPDATE "matches"
SET
  "round_name" = TRIM(SPLIT_PART("notes", ':', 1)),
  "stage" = CASE
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%winner%' THEN 'winners'
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%loser%' THEN 'losers'
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%grand final%' THEN 'grand_finals'
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%knockout%' OR LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%playoff%' THEN 'knockout'
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%group%' THEN 'group'
    ELSE 'other'
  END,
  "bracket_group" = CASE
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%legend%' THEN 'Legends Group'
    WHEN LOWER(SPLIT_PART("notes", ':', 1)) LIKE '%challenger%' THEN 'Challengers Group'
    ELSE NULL
  END
WHERE "notes" IS NOT NULL AND "notes" LIKE '%:%' AND "stage" IS NULL;