-- The append-only trigger from migration 0031 guards existing columns the
-- moment it fires. "details" is deliberately left OUT of that guard here so
-- that a one-off backfill (db/backfill-application-details.ts) can populate
-- it on pre-existing rows after this migration runs. Migration 0034 extends
-- the trigger to cover "details" too — apply it only after the backfill has
-- finished, never before, or the backfill's UPDATEs will be rejected.
ALTER TABLE "school_applications" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "staff_applications" ADD COLUMN "details" jsonb;