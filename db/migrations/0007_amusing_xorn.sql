CREATE TYPE "public"."news_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "published_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "published_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "status" "news_status" DEFAULT 'published' NOT NULL;