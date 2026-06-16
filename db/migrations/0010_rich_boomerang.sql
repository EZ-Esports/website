CREATE TYPE "public"."admin_role" AS ENUM('admin', 'super_admin');--> statement-breakpoint
CREATE TABLE "admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "admin_invites_email_idx" ON "admin_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_users_email_idx" ON "admin_users" USING btree ("email");