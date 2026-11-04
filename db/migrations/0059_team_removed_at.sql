-- spec-058: remove a school from a game's season without deleting anything.
--
-- Hand-written like 0043 onward: the drizzle-kit snapshot chain stops at 0042, so `db:generate` refuses to run.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the code. New code selects and filters on
-- teams.removed_at in public, portal and staff queries, so every one of them fails until it exists.
-- Additive and nullable: existing rows are unaffected (null = still in the season), no backfill.
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;
