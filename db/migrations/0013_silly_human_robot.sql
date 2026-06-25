CREATE TABLE "admin_invite_roles" (
	"invite_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "admin_invite_roles_invite_id_role_id_pk" PRIMARY KEY("invite_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "admin_invite_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#94a3b8' NOT NULL,
	"permissions" bigint DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_invite_roles" ADD CONSTRAINT "admin_invite_roles_invite_id_admin_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."admin_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invite_roles" ADD CONSTRAINT "admin_invite_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_admin_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "admin_invites" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "admin_users" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."admin_role";