ALTER TABLE "player_invites" ADD COLUMN IF NOT EXISTS "season_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "player_invites" ADD CONSTRAINT "player_invites_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_invites_season_id_idx" ON "player_invites" USING btree ("season_id");--> statement-breakpoint
-- Legacy backfill (spec-045). Only rows still NULL are touched, so a re-run changes nothing.
-- Rows no step can place stay NULL; managers never see or review those (staff admins still do).
-- 1. An accepted invite whose student sits on exactly one team of the invite's school and game
--    belongs to that team's season.
UPDATE "player_invites" AS pi
SET "season_id" = x."season_id"
FROM (
	SELECT pi2."id" AS "invite_id", (array_agg(DISTINCT t."season_id"))[1] AS "season_id"
	FROM "player_invites" pi2
	INNER JOIN "players" p ON p."member_id" = pi2."member_id"
	INNER JOIN "rosters" r ON r."id" = p."roster_id"
	INNER JOIN "teams" t ON t."id" = r."team_id" AND t."school_id" = pi2."school_id" AND t."game_id" = pi2."game_id"
	WHERE pi2."season_id" IS NULL AND pi2."status" = 'accepted' AND pi2."member_id" IS NOT NULL
	GROUP BY pi2."id"
	HAVING COUNT(DISTINCT t."season_id") = 1
) x
WHERE pi."id" = x."invite_id";--> statement-breakpoint
-- 2. Invites still in the manager queue (pending or submitted) belong to the game's active season,
--    when the game has exactly one, so the in-flight queue does not vanish for managers on deploy.
UPDATE "player_invites" AS pi
SET "season_id" = a."season_id"
FROM (
	SELECT "game_id", (array_agg("id"))[1] AS "season_id"
	FROM "seasons"
	WHERE "is_active" = true
	GROUP BY "game_id"
	HAVING COUNT(*) = 1
) a
WHERE pi."season_id" IS NULL AND pi."status" IN ('pending', 'submitted') AND pi."game_id" = a."game_id";--> statement-breakpoint
-- 3. Any other invite of a game that has only ever had one season belongs to that season.
UPDATE "player_invites" AS pi
SET "season_id" = s."season_id"
FROM (
	SELECT "game_id", (array_agg("id"))[1] AS "season_id"
	FROM "seasons"
	GROUP BY "game_id"
	HAVING COUNT(*) = 1
) s
WHERE pi."season_id" IS NULL AND pi."game_id" = s."game_id";
