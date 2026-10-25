ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "counts_for_standings" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DROP VIEW IF EXISTS "public"."roster_standings";
--> statement-breakpoint
CREATE VIEW "public"."roster_standings" WITH (security_invoker = true) AS (
  SELECT
    r.id, r.team_id, r.name, r.division, r.created_at, r.updated_at,
    (SELECT COUNT(*) FROM matches m WHERE m.counts_for_standings AND ((m.home_roster_id = r.id AND m.home_score > m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score > m.home_score AND m.status IN ('completed', 'forfeit'))))::int as wins,
    (SELECT COUNT(*) FROM matches m WHERE m.counts_for_standings AND ((m.home_roster_id = r.id AND m.home_score < m.away_score AND m.status IN ('completed', 'forfeit')) OR (m.away_roster_id = r.id AND m.away_score < m.home_score AND m.status IN ('completed', 'forfeit'))))::int as losses
  FROM rosters r
);
--> statement-breakpoint
GRANT SELECT ON "public"."roster_standings" TO "anon", "authenticated";
