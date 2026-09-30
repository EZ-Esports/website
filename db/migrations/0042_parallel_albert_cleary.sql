ALTER TABLE "player_invites" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "player_invites" ADD COLUMN "submission_draft" jsonb;--> statement-breakpoint
ALTER TABLE "player_invites" ADD CONSTRAINT "player_invites_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_invites_member_id_idx" ON "player_invites" USING btree ("member_id");