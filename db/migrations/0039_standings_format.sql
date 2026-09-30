ALTER TABLE "matches" DROP CONSTRAINT "matches_season_id_seasons_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_active_per_game_idx" ON "seasons" USING btree ("game_id") WHERE is_active = true;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_captain_role_check" CHECK (("players"."is_captain" = true AND "players"."role" = 'captain') OR ("players"."is_captain" = false AND "players"."role" <> 'captain'));--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_standings_format_check" CHECK ("seasons"."standings_format" IN ('divided', 'combined'));