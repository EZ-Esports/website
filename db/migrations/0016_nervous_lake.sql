CREATE TABLE "season_standings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"division" text NOT NULL,
	"rank" integer,
	"wins" integer,
	"losses" integer,
	"games_played" integer,
	"win_pct" real,
	"player_name" text,
	"player_ign" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season_standings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_standings_season_id_idx" ON "season_standings" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "season_standings_school_id_idx" ON "season_standings" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "season_standings_division_idx" ON "season_standings" USING btree ("division");--> statement-breakpoint
CREATE POLICY "season_standings_public_select"
ON "public"."season_standings"
FOR SELECT
TO "anon", "authenticated"
USING (true);--> statement-breakpoint
CREATE POLICY "season_standings_admin_insert"
ON "public"."season_standings"
FOR INSERT
TO "authenticated"
WITH CHECK ((SELECT "public"."is_admin"()));--> statement-breakpoint
CREATE POLICY "season_standings_admin_update"
ON "public"."season_standings"
FOR UPDATE
TO "authenticated"
USING ((SELECT "public"."is_admin"()))
WITH CHECK ((SELECT "public"."is_admin"()));--> statement-breakpoint
CREATE POLICY "season_standings_admin_delete"
ON "public"."season_standings"
FOR DELETE
TO "authenticated"
USING ((SELECT "public"."is_admin"()));
