ALTER TABLE "staff_members" ADD COLUMN IF NOT EXISTS "member_id" uuid REFERENCES "members"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_members_member_id_idx" ON "staff_members" USING btree ("member_id");--> statement-breakpoint
UPDATE "staff_members" s
SET "member_id" = m."id"
FROM "members" m
WHERE lower(s."email") = lower(m."email")
  AND s."member_id" IS NULL;
