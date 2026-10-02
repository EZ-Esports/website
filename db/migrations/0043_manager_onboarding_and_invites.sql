ALTER TABLE "player_invites" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "player_invites" ADD COLUMN "role" text DEFAULT 'player' NOT NULL;--> statement-breakpoint
CREATE INDEX "player_invites_school_role_idx" ON "player_invites" USING btree ("school_id", "role");--> statement-breakpoint
ALTER TABLE "school_managers" ADD COLUMN IF NOT EXISTS "member_id" uuid REFERENCES "members"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "school_managers_member_id_idx" ON "school_managers" USING btree ("member_id");
