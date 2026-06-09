CREATE TABLE "page_content_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_key" text NOT NULL,
	"previous_content" text NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_content_history_key_idx" ON "page_content_history" USING btree ("content_key");