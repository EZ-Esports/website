-- leadership.member_id: CASCADE -> SET NULL.
--
-- This is the constraint that destroyed data. `db:seed:gold` deletes `members`
-- on every run, and under CASCADE that took every leadership row which happened
-- to carry a member link with it — 70 rows, with no backup behind them. The
-- rows that survived were the ones that had never been linked.
--
-- SET NULL is the honest rule: a leadership row records that somebody held a
-- role in a year, and `name` is NOT NULL on every row specifically so the row
-- still renders with its link cleared. Losing the link costs a join, not a
-- record.
--
-- Rewriting the constraint rewrites no rows, and every surviving row already
-- has member_id NULL, so there is nothing here that can fail to validate.
ALTER TABLE "leadership" DROP CONSTRAINT "leadership_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "leadership" ADD CONSTRAINT "leadership_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;