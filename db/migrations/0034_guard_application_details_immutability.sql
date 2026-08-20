-- Extends the append-only immutability guard from migration 0031 to also cover
-- the "details" column added in migration 0033, so it gets the same audit-trail
-- protection as every other submission field.
--
-- Must run AFTER db/backfill-application-details.ts has finished populating
-- historical rows -- once this trigger is active, any UPDATE that changes
-- "details" (including null -> non-null) is rejected, even for backfill.
CREATE OR REPLACE FUNCTION prevent_application_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Table % is immutable: DELETE operations are prohibited', TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'application_status_logs' THEN
      RAISE EXCEPTION 'Table application_status_logs is immutable: UPDATE operations are prohibited';
    ELSIF TG_TABLE_NAME = 'school_applications' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR
         NEW.applicant_name IS DISTINCT FROM OLD.applicant_name OR
         NEW.school_name IS DISTINCT FROM OLD.school_name OR
         NEW.role IS DISTINCT FROM OLD.role OR
         NEW.email IS DISTINCT FROM OLD.email OR
         NEW.message IS DISTINCT FROM OLD.message OR
         NEW.details IS DISTINCT FROM OLD.details OR
         NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'School application submission fields are immutable';
      END IF;
    ELSIF TG_TABLE_NAME = 'staff_applications' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR
         NEW.name IS DISTINCT FROM OLD.name OR
         NEW.preferred_first_name IS DISTINCT FROM OLD.preferred_first_name OR
         NEW.email IS DISTINCT FROM OLD.email OR
         NEW.phone IS DISTINCT FROM OLD.phone OR
         NEW.discord_tag IS DISTINCT FROM OLD.discord_tag OR
         NEW.role IS DISTINCT FROM OLD.role OR
         NEW.message IS DISTINCT FROM OLD.message OR
         NEW.details IS DISTINCT FROM OLD.details OR
         NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Staff application submission fields are immutable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
