CREATE TYPE "public"."application_status" AS ENUM('pending', 'reviewed', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."sponsor_tier" AS ENUM('platinum', 'gold', 'community');--> statement-breakpoint
CREATE TABLE "gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"src" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"school_name" text DEFAULT '',
	"event_name" text DEFAULT '',
	"display_order" integer DEFAULT 0 NOT NULL,
	"set_id" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"storage_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "page_content_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "school_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_name" text NOT NULL,
	"school_name" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"message" text DEFAULT '',
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_url" text DEFAULT '',
	"tier" "sponsor_tier" DEFAULT 'community' NOT NULL,
	"website_url" text DEFAULT '',
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"storage_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "storage_key" text;--> statement-breakpoint
CREATE INDEX "gallery_images_set_id_idx" ON "gallery_images" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "gallery_images_display_order_idx" ON "gallery_images" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "school_applications_status_idx" ON "school_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "school_applications_submitted_at_idx" ON "school_applications" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "sponsors_tier_idx" ON "sponsors" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "sponsors_display_order_idx" ON "sponsors" USING btree ("display_order");