ALTER TABLE "gallery_images" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
--> statement-breakpoint
ALTER TABLE "gallery_images" ADD COLUMN IF NOT EXISTS "thumbnail_storage_key" text;
