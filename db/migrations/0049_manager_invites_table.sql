-- Move school-manager invites out of player_invites into their own table.
-- Runs inside drizzle's migration transaction; any RAISE below aborts the whole migration.

CREATE TABLE "manager_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"intended_first_name" text NOT NULL,
	"intended_last_name" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"member_id" uuid,
	"submission_draft" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manager_invites_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
ALTER TABLE "manager_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manager_invites_school_idx" ON "manager_invites" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "manager_invites_member_id_idx" ON "manager_invites" USING btree ("member_id");--> statement-breakpoint

-- Copy every manager row, preserving id and token_hash so outstanding links keep resolving.
INSERT INTO "manager_invites" (
	"id", "school_id", "token_hash", "intended_first_name", "intended_last_name",
	"invited_by_user_id", "status", "expires_at", "submitted_at", "reviewed_at",
	"rejection_reason", "member_id", "submission_draft", "created_at"
)
SELECT
	"id", "school_id", "token_hash", "intended_first_name", "intended_last_name",
	"invited_by_user_id", "status", "expires_at", "submitted_at", "reviewed_at",
	"rejection_reason", "member_id", "submission_draft", "created_at"
FROM "player_invites"
WHERE "role" = 'manager';--> statement-breakpoint

-- Refuse to delete anything that was not copied verbatim.
DO $$
DECLARE
	expected integer;
	copied integer;
BEGIN
	SELECT count(*) INTO expected FROM "player_invites" WHERE "role" = 'manager';
	SELECT count(*) INTO copied
	FROM "player_invites" p
	JOIN "manager_invites" m ON m."id" = p."id" AND m."token_hash" = p."token_hash"
	WHERE p."role" = 'manager';
	IF expected <> copied THEN
		RAISE EXCEPTION 'manager_invites copy mismatch: % manager rows in player_invites, % copied', expected, copied;
	END IF;
END $$;--> statement-breakpoint

DELETE FROM "player_invites" WHERE "role" = 'manager';--> statement-breakpoint

DROP INDEX IF EXISTS "player_invites_school_role_idx";--> statement-breakpoint
ALTER TABLE "player_invites" DROP COLUMN "role";--> statement-breakpoint

-- Fail loudly instead of silently if any player invite still has no game.
DO $$
DECLARE
	null_games integer;
BEGIN
	SELECT count(*) INTO null_games FROM "player_invites" WHERE "game_id" IS NULL;
	IF null_games > 0 THEN
		RAISE EXCEPTION 'Cannot restore player_invites.game_id NOT NULL: % rows have a null game_id', null_games;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "player_invites" ALTER COLUMN "game_id" SET NOT NULL;
