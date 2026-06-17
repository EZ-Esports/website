CREATE UNIQUE INDEX "admin_invites_email_pending_unique" ON "admin_invites" USING btree ("email") WHERE "admin_invites"."accepted_at" is null;
--> statement-breakpoint
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_invites" ENABLE ROW LEVEL SECURITY;