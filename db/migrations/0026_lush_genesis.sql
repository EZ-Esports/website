ALTER TABLE "matches" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_key" text;--> statement-breakpoint
ALTER TABLE "season_standings" ADD COLUMN "source_key" text;--> statement-breakpoint
-- Backfill the archive natural keys for rows that are already here.
--
-- This is load-bearing, not a convenience. The gold seed is about to move from
-- delete-and-reinsert to upsert-on-natural-key; if the existing rows carried no
-- key, that first upsert would match nothing, re-insert the whole archive, and
-- churn every UUID one last time — which is the exact failure this work exists
-- to stop (stale unstable_cache entries pointing at dead UUIDs).
--
-- All three backfills have to produce keys that are unique across their table,
-- because the unique indexes go on at the end of this migration. A migration
-- that can abort on data a user was allowed to create is not acceptable, so
-- each one is written so that it cannot produce a duplicate — see the notes.
--
-- members: `${school_slug}|${lower first}|${lower last}`, byte-identical to
-- gold_members.csv's own member_key column. Verified against the archive: the
-- tuple (first_name, last_name, school_slug) has zero collisions over all 772
-- rows, and the 772 keys computed here are set-equal to the 772 in the CSV.
--
-- But the archive is not the only source of members. createMember (the admin
-- roster editor) has no duplicate check, so two same-named members at the same
-- school are a legal state, and an unconditional UPDATE would abort this whole
-- migration on them with a duplicate-key error. So only rows whose derived key
-- is unambiguous — group size exactly 1 — are stamped; the rest stay NULL. All
-- of them, including the archive row, if someone duplicated an archive member's
-- name: once the group is ambiguous there is no honest way to say which row the
-- archive one is, and a wrong guess would attach the archive's identity to the
-- admin's row. On today's production every group has size 1 and all 772 rows
-- are stamped; the filter is there for the state a user is allowed to create.
--
-- NULL is the right answer for those rows twice over. It is safe (the unique
-- index is NULLS DISTINCT, and PR2's seed just inserts a row for a key it
-- cannot find), and an archive-shaped key on a member that has no archive row
-- would be a lie about where the row came from — see the comment on the column
-- in app/lib/db/schema.ts.
WITH derived AS (
  SELECT
    m."id",
    s."slug" || '|' || lower(m."first_name") || '|' || lower(m."last_name") AS member_key,
    count(*) OVER (
      PARTITION BY m."school_id", lower(m."first_name"), lower(m."last_name")
    ) AS group_size
  FROM "members" m
  JOIN "schools" s ON s."id" = m."school_id"
)
UPDATE "members" m
SET "member_key" = d.member_key
FROM derived d
WHERE d."id" = m."id"
  AND d.group_size = 1;--> statement-breakpoint
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
-- Unlike the members backfill, this one cannot abort: row_number() gives every
-- row in a group a different ordinal, so the keys are unique by construction no
-- matter how many rows share the natural fields — including any an admin
-- created through the matches editor.
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
-- season_standings:
--   `${season}|${game_slug}|${division}|${school_slug}|${player_name}#${n}`.
-- player_name is coalesced to '' because the CSV column is empty on 138 of the
-- 183 rows and the seed stores that as NULL, while the key is derived from the
-- CSV's own empty string.
--
-- `rank` is deliberately NOT part of this key, even though it would make the
-- natural fields unique on today's data. rank is payload: an admin corrects it
-- from the standings editor, and if it were in the key that correction would
-- re-key the row, so PR2's upsert would insert a duplicate instead of updating.
-- The 45 TFT rows in the "All" division make that acute — their ranks are
-- league-wide, so adding a single player re-keys dozens of rows at once and
-- churns every one of their UUIDs, which is precisely what this stack exists to
-- prevent. Leaving rank out also leaves the admin's optional rank input alone:
-- rank-less rows are a supported state and must not collide with each other.
--
-- The ordinal covers the 2 groups that do collide without rank, both TFT
-- 2021-22 Varsity: Midwood at ranks 2 and 6, Stuyvesant at ranks 3 and 5. Those
-- are per-player rows whose player_name the normalizer never recovered, so 4
-- rows out of 183 carry no identity in the data at all and any discriminator
-- for them is arbitrary. As with matches, both keys in a group exist after this
-- backfill, so the seed's upsert matches a row for every key it computes and
-- never orphans or re-inserts one; at worst the two rows in a group trade
-- payload once and are stable from then on. Ordering by rank is deterministic
-- and is also the order the CSV is in, so for these 4 rows the assignment is in
-- fact identical to what the seed derives. It also sorts an admin-created row
-- that shares a prefix (rank optional, so NULL, so NULLS LAST) behind the
-- archive rows, leaving their ordinals — and so the seed's ability to find
-- them — untouched.
--
-- Like the matches backfill and unlike members, this cannot abort: row_number()
-- makes the keys unique by construction however many rows share a prefix.
WITH natural_key AS (
  SELECT
    ss."id",
    se."name" || '|' || g."slug" || '|' || ss."division" || '|' || sc."slug" || '|'
      || coalesce(ss."player_name", '') AS prefix,
    ss."rank"
  FROM "season_standings" ss
  JOIN "seasons" se ON se."id" = ss."season_id"
  JOIN "games" g ON g."id" = se."game_id"
  JOIN "schools" sc ON sc."id" = ss."school_id"
), keyed AS (
  SELECT
    "id",
    prefix || '#' || (
      row_number() OVER (PARTITION BY prefix ORDER BY "rank" NULLS LAST, "id") - 1
    )::text AS source_key
  FROM natural_key
)
UPDATE "season_standings" ss
SET "source_key" = k.source_key
FROM keyed k
WHERE k."id" = ss."id";--> statement-breakpoint
CREATE UNIQUE INDEX "matches_source_key_unique_idx" ON "matches" USING btree ("source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_key_unique_idx" ON "members" USING btree ("member_key");--> statement-breakpoint
CREATE UNIQUE INDEX "season_standings_source_key_unique_idx" ON "season_standings" USING btree ("source_key");