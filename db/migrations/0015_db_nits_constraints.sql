-- Custom SQL migration file, put your code below! --

-- 1. Create missing indexes on foreign key role_id columns
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");
--> statement-breakpoint

CREATE INDEX "admin_invite_roles_role_id_idx" ON "admin_invite_roles" USING btree ("role_id");
--> statement-breakpoint


-- 2. Add CHECK constraints to roles table to protect data ranges
ALTER TABLE "roles" ADD CONSTRAINT "roles_position_check" CHECK ("position" >= 0);
--> statement-breakpoint

ALTER TABLE "roles" ADD CONSTRAINT "roles_permissions_check" CHECK ("permissions" >= 0);
--> statement-breakpoint


-- 3. Create a trigger function to protect system-defined roles (Owner & @everyone)
CREATE OR REPLACE FUNCTION "public"."protect_system_roles"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent deletion of system roles
  IF TG_OP = 'DELETE' AND OLD."is_system" = true THEN
    RAISE EXCEPTION 'System-defined roles cannot be deleted.';
  END IF;
  
  -- Prevent modifying critical invariants on system roles
  IF TG_OP = 'UPDATE' AND OLD."is_system" = true THEN
    IF NEW."name" != OLD."name" THEN
      RAISE EXCEPTION 'System-defined role names are immutable.';
    END IF;
    
    IF OLD."is_owner" = true THEN
      IF NEW."is_owner" = false THEN
        RAISE EXCEPTION 'The Owner system role cannot be demoted.';
      END IF;
      IF NEW."permissions" != OLD."permissions" THEN
        RAISE EXCEPTION 'The Owner system role permissions are immutable.';
      END IF;
    END IF;
    
    IF OLD."name" = '@everyone' AND NEW."position" != 0 THEN
      RAISE EXCEPTION 'The @everyone role position must remain 0.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "protect_system_roles_trigger"
  BEFORE UPDATE OR DELETE ON "public"."roles"
  FOR EACH ROW EXECUTE FUNCTION "public"."protect_system_roles"();