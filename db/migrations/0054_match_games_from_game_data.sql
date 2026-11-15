CREATE TABLE IF NOT EXISTS "valorant_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"riot_match_id" text NOT NULL,
	"map_id" text NOT NULL,
	"map_name" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"game_length_ms" integer NOT NULL,
	"queue_id" text NOT NULL,
	"game_version" text,
	"red_rounds" integer NOT NULL,
	"blue_rounds" integer NOT NULL,
	"winning_side" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "valorant_games_winning_side_check" CHECK ("valorant_games"."winning_side" in ('Red', 'Blue'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "valorant_game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"puuid" text NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"side" text NOT NULL,
	"agent" text NOT NULL,
	"tier" text,
	"score" integer NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"assists" integer NOT NULL,
	"headshots" integer NOT NULL,
	"bodyshots" integer NOT NULL,
	"legshots" integer NOT NULL,
	"damage_dealt" integer NOT NULL,
	"damage_received" integer NOT NULL,
	"is_match_mvp" boolean DEFAULT false NOT NULL,
	"is_team_mvp" boolean DEFAULT false NOT NULL,
	CONSTRAINT "valorant_game_players_side_check" CHECK ("valorant_game_players"."side" in ('Red', 'Blue'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"game_number" integer NOT NULL,
	"home_side" text NOT NULL,
	"home_rounds" integer NOT NULL,
	"away_rounds" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_games_home_side_check" CHECK ("match_games"."home_side" in ('Red', 'Blue')),
	CONSTRAINT "match_games_game_number_check" CHECK ("match_games"."game_number" between 1 and 3)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_result_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"submitted_by_school_id" uuid NOT NULL,
	"riot_match_ids" text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_after" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_result_submissions_status_check" CHECK ("match_result_submissions"."status" in ('pending', 'completed', 'cancelled'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_result_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "match_result_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_result_attempts" ADD CONSTRAINT "match_result_attempts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_result_attempts_match_created_idx" ON "match_result_attempts" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_result_attempts_user_created_idx" ON "match_result_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "valorant_games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "valorant_game_players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_result_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "valorant_game_players" ADD CONSTRAINT "valorant_game_players_game_id_valorant_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."valorant_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_game_id_valorant_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."valorant_games"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_result_submissions" ADD CONSTRAINT "match_result_submissions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_result_submissions" ADD CONSTRAINT "match_result_submissions_submitted_by_school_id_schools_id_fk" FOREIGN KEY ("submitted_by_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "valorant_games_riot_match_id_idx" ON "valorant_games" USING btree ("riot_match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "valorant_game_players_game_id_idx" ON "valorant_game_players" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "valorant_game_players_game_puuid_idx" ON "valorant_game_players" USING btree ("game_id","puuid");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_games_game_id_idx" ON "match_games" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_games_match_game_number_idx" ON "match_games" USING btree ("match_id","game_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_result_submissions_match_id_idx" ON "match_result_submissions" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_result_submissions_one_pending_per_match_idx" ON "match_result_submissions" USING btree ("match_id") WHERE status = 'pending';
