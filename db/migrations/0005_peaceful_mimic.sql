ALTER TABLE "schools" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "website_url" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;