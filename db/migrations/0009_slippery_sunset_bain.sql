ALTER TABLE "gallery_images" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "leadership" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "deleted_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "players_roster_one_captain_idx" ON "players" USING btree ("roster_id") WHERE is_captain = true;