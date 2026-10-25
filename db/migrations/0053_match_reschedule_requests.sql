CREATE TABLE IF NOT EXISTS "match_reschedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"requested_by_school_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending_opponent' NOT NULL,
	"is_late" boolean NOT NULL,
	"original_scheduled_at" timestamp NOT NULL,
	"accepted_option_id" uuid,
	"opponent_responded_by_user_id" uuid,
	"opponent_responded_at" timestamp,
	"decided_by_staff_id" text,
	"decided_at" timestamp,
	"staff_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_reschedule_requests_status_check" CHECK ("match_reschedule_requests"."status" in ('pending_opponent', 'pending_staff', 'approved', 'declined_opponent', 'declined_staff', 'cancelled'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_reschedule_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"proposed_at" timestamp NOT NULL
);--> statement-breakpoint
ALTER TABLE "match_reschedule_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_reschedule_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_reschedule_requests" ADD CONSTRAINT "match_reschedule_requests_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reschedule_requests" ADD CONSTRAINT "match_reschedule_requests_requested_by_school_id_schools_id_fk" FOREIGN KEY ("requested_by_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reschedule_options" ADD CONSTRAINT "match_reschedule_options_request_id_match_reschedule_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."match_reschedule_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_reschedule_requests_match_id_idx" ON "match_reschedule_requests" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_reschedule_requests_school_id_idx" ON "match_reschedule_requests" USING btree ("requested_by_school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_reschedule_requests_status_idx" ON "match_reschedule_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_reschedule_requests_one_open_per_match_idx" ON "match_reschedule_requests" USING btree ("match_id") WHERE status in ('pending_opponent', 'pending_staff');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_reschedule_options_request_id_idx" ON "match_reschedule_options" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_reschedule_options_request_time_idx" ON "match_reschedule_options" USING btree ("request_id","proposed_at");
