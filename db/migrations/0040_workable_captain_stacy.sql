CREATE TYPE "public"."tournament_format" AS ENUM('single_elimination', 'double_elimination', 'groups_and_knockout', 'swiss', 'round_robin');--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"round_name" text NOT NULL,
	"round_order" integer DEFAULT 1 NOT NULL,
	"match_order" integer DEFAULT 1 NOT NULL,
	"bracket_group" text,
	"scheduled_at" timestamp NOT NULL,
	"status" "match_status" DEFAULT 'completed' NOT NULL,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	"home_player_title" text NOT NULL,
	"away_player_title" text NOT NULL,
	"home_school_id" uuid,
	"away_school_id" uuid,
	"home_score" integer,
	"away_score" integer,
	"winner_side" text,
	"notes" text,
	"source_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournament_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"season_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"format" "tournament_format" DEFAULT 'double_elimination' NOT NULL,
	"status" "match_status" DEFAULT 'completed' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournaments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_home_school_id_schools_id_fk" FOREIGN KEY ("home_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_away_school_id_schools_id_fk" FOREIGN KEY ("away_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_matches_tournament_id_idx" ON "tournament_matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "tournament_matches_stage_idx" ON "tournament_matches" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "tournament_matches_scheduled_at_idx" ON "tournament_matches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "tournament_matches_home_school_id_idx" ON "tournament_matches" USING btree ("home_school_id");--> statement-breakpoint
CREATE INDEX "tournament_matches_away_school_id_idx" ON "tournament_matches" USING btree ("away_school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_matches_source_key_unique_idx" ON "tournament_matches" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "tournaments_game_id_idx" ON "tournaments" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "tournaments_season_id_idx" ON "tournaments" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_game_slug_unique_idx" ON "tournaments" USING btree ("game_id","slug");--> statement-breakpoint
INSERT INTO "tournaments" ("id", "game_id", "season_id", "name", "slug", "format", "status")
SELECT
  gen_random_uuid(),
  s.game_id,
  s.id,
  'TETR.IO ' || s.name || ' Championship',
  s.name,
  CASE WHEN s.name = '2025-26' THEN 'groups_and_knockout'::tournament_format ELSE 'double_elimination'::tournament_format END,
  'completed'::match_status
FROM "seasons" s
JOIN "games" g ON s.game_id = g.id
WHERE g.slug = 'tetr-io'
ON CONFLICT ("game_id", "slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "tournament_matches" (
  "id", "tournament_id", "stage", "round_name", "round_order", "match_order",
  "bracket_group", "scheduled_at", "status", "is_forfeit", "home_player_title",
  "away_player_title", "home_school_id", "away_school_id", "home_score", "away_score",
  "winner_side", "notes", "source_key"
)
SELECT
  m.id,
  t.id as tournament_id,
  CASE
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%winner%' THEN 'winners'
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%loser%' THEN 'losers'
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%grand final%' THEN 'grand_finals'
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%knockout%' OR LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%playoff%' THEN 'knockout'
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%group%' THEN 'group'
    ELSE 'other'
  END as stage,
  COALESCE(NULLIF(TRIM(SPLIT_PART(m.notes, ':', 1)), ''), 'Match') as round_name,
  DENSE_RANK() OVER (
    PARTITION BY t.id,
    CASE
      WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%winner%' THEN 'winners'
      WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%loser%' THEN 'losers'
      WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%grand final%' THEN 'grand_finals'
      WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%knockout%' OR LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%playoff%' THEN 'knockout'
      WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%group%' THEN 'group'
      ELSE 'other'
    END
    ORDER BY m.scheduled_at
  ) as round_order,
  ROW_NUMBER() OVER (
    PARTITION BY t.id, COALESCE(NULLIF(TRIM(SPLIT_PART(m.notes, ':', 1)), ''), 'Match')
    ORDER BY m.scheduled_at, m.id
  ) as match_order,
  CASE
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%legend%' THEN 'Legends Group'
    WHEN LOWER(SPLIT_PART(m.notes, ':', 1)) LIKE '%challenger%' THEN 'Challengers Group'
    ELSE NULL
  END as bracket_group,
  m.scheduled_at,
  m.status,
  (m.status = 'forfeit') as is_forfeit,
  CASE
    WHEN m.notes LIKE '%:% vs %' THEN TRIM(SPLIT_PART(SPLIT_PART(m.notes, ':', 2), ' vs ', 1))
    ELSE hs.name
  END as home_player_title,
  CASE
    WHEN m.notes LIKE '%:% vs %' THEN TRIM(SPLIT_PART(SPLIT_PART(m.notes, ':', 2), ' vs ', 2))
    ELSE aws.name
  END as away_player_title,
  hs.id as home_school_id,
  aws.id as away_school_id,
  m.home_score,
  m.away_score,
  CASE
    WHEN m.home_score > m.away_score THEN 'home'
    WHEN m.away_score > m.home_score THEN 'away'
    ELSE NULL
  END as winner_side,
  m.notes,
  m.source_key
FROM "matches" m
JOIN "seasons" s ON m.season_id = s.id
JOIN "games" g ON s.game_id = g.id
JOIN "tournaments" t ON t.season_id = s.id
JOIN "rosters" hr ON m.home_roster_id = hr.id
JOIN "teams" ht ON hr.team_id = ht.id
JOIN "schools" hs ON ht.school_id = hs.id
JOIN "rosters" ar ON m.away_roster_id = ar.id
JOIN "teams" at ON ar.team_id = at.id
JOIN "schools" aws ON at.school_id = aws.id
WHERE g.slug = 'tetr-io'
ON CONFLICT ("source_key") DO NOTHING;--> statement-breakpoint
DELETE FROM "matches"
WHERE "season_id" IN (
  SELECT s.id FROM "seasons" s
  JOIN "games" g ON s.game_id = g.id
  WHERE g.slug = 'tetr-io'
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournaments' AND policyname = 'tournaments_public_select'
  ) THEN
    CREATE POLICY "tournaments_public_select" ON "public"."tournaments"
    FOR SELECT TO "anon", "authenticated" USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournament_matches' AND policyname = 'tournament_matches_public_select'
  ) THEN
    CREATE POLICY "tournament_matches_public_select" ON "public"."tournament_matches"
    FOR SELECT TO "anon", "authenticated" USING (true);
  END IF;
END $$;