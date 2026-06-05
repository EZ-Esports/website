CREATE TABLE "leadership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"year" text NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leadership_year_idx" ON "leadership" USING btree ("year");--> statement-breakpoint
CREATE INDEX "matches_scheduled_at_idx" ON "matches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_season_id_idx" ON "matches" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "matches_home_team_id_idx" ON "matches" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "matches_away_team_id_idx" ON "matches" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX "news_posts_published_at_idx" ON "news_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "rosters_team_id_idx" ON "rosters" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "seasons_game_id_idx" ON "seasons" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "teams_game_id_idx" ON "teams" USING btree ("game_id");