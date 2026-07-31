ALTER TABLE "matches" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_key" text;--> statement-breakpoint
-- Backfill the archive natural keys for rows that are already here.
--
-- This is load-bearing, not a convenience. The gold seed is about to move from
-- delete-and-reinsert to upsert-on-natural-key; if the existing rows carried no
-- key, that first upsert would match nothing, re-insert the whole archive, and
-- churn every UUID one last time — which is the exact failure this work exists
-- to stop (stale unstable_cache entries pointing at dead UUIDs).
--
-- members: `${school_slug}|${lower first}|${lower last}`, byte-identical to
-- gold_members.csv's own member_key column. Verified against the archive: the
-- tuple (first_name, last_name, school_slug) has zero collisions over all 772
-- rows, and the 772 keys computed here are set-equal to the 772 in the CSV.
UPDATE "members" m
SET "member_key" = s."slug" || '|' || lower(m."first_name") || '|' || lower(m."last_name")
FROM "schools" s
WHERE s."id" = m."school_id";--> statement-breakpoint
-- matches: the natural fields plus a `#n` occurrence ordinal. scheduled_at is
-- rendered back to the America/New_York wall time the CSV carries (the seed
-- parses it as Eastern and stores UTC); UTC -> local is always unambiguous, so
-- this direction is DST-safe.
--
-- The ordinal is required because the natural fields are not unique: the 2022-23
-- Valorant scheduled_at values are synthesized from a weekly date block, so two
-- different rounds of New Dorp vs Cardozo land on 2022-12-28 19:30 — once in
-- Varsity, once in JV, 4 rows. Those rows are identical in every column except
-- free-text `notes`.
--
-- Which of the two rows in a collision group gets #0 is arbitrary here (ordered
-- by notes for determinism, since file order is not recoverable from the
-- database). That is safe: both keys in the group exist after this backfill, so
-- the seed's upsert matches an existing row for every key it computes and never
-- orphans or re-inserts one. At worst the two rows swap `notes` once, and are
-- stable from then on.
WITH natural_key AS (
  SELECT
    m."id",
    se."name" || '|' || g."slug" || '|'
      || hs."slug" || '|' || hr."division" || '|'
      || aws."slug" || '|' || ar."division" || '|'
      || to_char(
           m."scheduled_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York',
           'YYYY-MM-DD HH24:MI:SS'
         ) AS prefix,
    m."notes"
  FROM "matches" m
  JOIN "seasons" se ON se."id" = m."season_id"
  JOIN "games" g ON g."id" = se."game_id"
  JOIN "rosters" hr ON hr."id" = m."home_roster_id"
  JOIN "teams" ht ON ht."id" = hr."team_id"
  JOIN "schools" hs ON hs."id" = ht."school_id"
  JOIN "rosters" ar ON ar."id" = m."away_roster_id"
  JOIN "teams" awt ON awt."id" = ar."team_id"
  JOIN "schools" aws ON aws."id" = awt."school_id"
), keyed AS (
  SELECT
    "id",
    prefix || '#' || (
      row_number() OVER (PARTITION BY prefix ORDER BY "notes" NULLS FIRST, "id") - 1
    )::text AS source_key
  FROM natural_key
)
UPDATE "matches" m
SET "source_key" = k.source_key
FROM keyed k
WHERE k."id" = m."id";--> statement-breakpoint
CREATE UNIQUE INDEX "matches_source_key_unique_idx" ON "matches" USING btree ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_key_unique_idx" ON "members" USING btree ("member_key");--> statement-breakpoint
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_natural_key_unique" UNIQUE NULLS NOT DISTINCT("season_id","school_id","division","rank");
