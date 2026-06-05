CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'completed', 'forfeit', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."player_role" AS ENUM('captain', 'player', 'coach', 'sub');--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "player_role" DEFAULT 'player' NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "home_team_id" TO "home_roster_id";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_home_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_away_team_id_teams_id_fk";
--> statement-breakpoint
DROP INDEX "matches_home_team_id_idx";--> statement-breakpoint
DROP INDEX "matches_away_team_id_idx";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"public"."match_status";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DATA TYPE "public"."match_status" USING "status"::"public"."match_status";--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leadership" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "away_roster_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rosters" ADD COLUMN "season_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rosters" ADD COLUMN "division" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rosters" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rosters" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "players_roster_id_idx" ON "players" USING btree ("roster_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_roster_id_rosters_id_fk" FOREIGN KEY ("home_roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_roster_id_rosters_id_fk" FOREIGN KEY ("away_roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_home_roster_id_idx" ON "matches" USING btree ("home_roster_id");--> statement-breakpoint
CREATE INDEX "matches_away_roster_id_idx" ON "matches" USING btree ("away_roster_id");--> statement-breakpoint
CREATE INDEX "rosters_season_id_idx" ON "rosters" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rosters_team_season_name_unique_idx" ON "rosters" USING btree ("team_id","season_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_game_id_name_unique_idx" ON "seasons" USING btree ("game_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_game_id_name_unique_idx" ON "teams" USING btree ("game_id","name");--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "away_team_id";--> statement-breakpoint
ALTER TABLE "rosters" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "rosters" DROP COLUMN "bio";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "division";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "wins";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "losses";--> statement-breakpoint
CREATE VIEW "public"."roster_standings" AS (
  SELECT
    r.id, r.team_id, r.season_id, r.name, r.division, r.created_at, r.updated_at,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status = 'completed') OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status = 'completed'))::int as wins,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status = 'completed') OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status = 'completed'))::int as losses
  FROM rosters r
);