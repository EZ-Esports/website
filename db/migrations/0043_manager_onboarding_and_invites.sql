ALTER TABLE "player_invites" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "player_invites" ADD COLUMN "role" text DEFAULT 'player' NOT NULL;--> statement-breakpoint
CREATE INDEX "player_invites_school_role_idx" ON "player_invites" USING btree ("school_id", "role");
