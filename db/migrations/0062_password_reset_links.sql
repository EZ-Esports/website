-- Staff-issued one-time password reset links (spec-064). Additive only: one new table, no data touched.
-- RLS is enabled with no policies, like player_invites and manager_invites; the app uses the service role.

CREATE TABLE "password_reset_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"issued_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by" uuid,
	CONSTRAINT "password_reset_links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "password_reset_links_target_kind_check" CHECK ("password_reset_links"."target_kind" in ('manager', 'staff'))
);--> statement-breakpoint
ALTER TABLE "password_reset_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "password_reset_links_user_idx" ON "password_reset_links" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_links_one_outstanding_idx" ON "password_reset_links" USING btree ("user_id") WHERE used_at is null and revoked_at is null;
