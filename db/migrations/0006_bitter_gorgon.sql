ALTER TABLE "gallery_images" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "leadership" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "deleted_at" timestamp;