CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"discord" text,
	"graduation_year" integer,
	"school_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schools_name_unique" UNIQUE("name"),
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DROP VIEW "public"."roster_standings";--> statement-breakpoint
ALTER TABLE "rosters" DROP CONSTRAINT "rosters_season_id_seasons_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_game_id_games_id_fk";
--> statement-breakpoint
DROP INDEX "rosters_season_id_idx";--> statement-breakpoint
DROP INDEX "rosters_team_season_name_unique_idx";--> statement-breakpoint
DROP INDEX "teams_game_id_name_unique_idx";--> statement-breakpoint
ALTER TABLE "leadership" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "member_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "ign" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_captain" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "season_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_school_id_idx" ON "members" USING btree ("school_id");--> statement-breakpoint
ALTER TABLE "leadership" ADD CONSTRAINT "leadership_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "players_member_id_idx" ON "players" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_roster_member_unique_idx" ON "players" USING btree ("roster_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rosters_team_name_unique_idx" ON "rosters" USING btree ("team_id","name");--> statement-breakpoint
CREATE INDEX "teams_school_id_idx" ON "teams" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "teams_season_id_idx" ON "teams" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_school_game_season_unique_idx" ON "teams" USING btree ("school_id","game_id","season_id");--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "rosters" DROP COLUMN "season_id";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "name";--> statement-breakpoint
CREATE VIEW "public"."roster_standings" AS (
  SELECT
    r.id, r.team_id, r.name, r.division, r.created_at, r.updated_at,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status IN ('completed', 'forfeit')))::int as wins,
    (SELECT COUNT(*) FROM matches m WHERE (m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status IN ('completed', 'forfeit')))::int as losses
  FROM rosters r
);