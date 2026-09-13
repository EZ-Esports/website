CREATE TABLE "privacy_erasure_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"row_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"actor_identifier" text,
	"redacted_columns" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_erasure_events_operation_check" CHECK ("privacy_erasure_events"."operation" IN ('redact', 'delete'))
);
--> statement-breakpoint
ALTER TABLE "privacy_erasure_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "privacy_erasure_events_row_id_idx" ON "privacy_erasure_events" USING btree ("row_id");--> statement-breakpoint
CREATE INDEX "privacy_erasure_events_created_at_idx" ON "privacy_erasure_events" USING btree ("created_at");
--> statement-breakpoint
-- Staff with MANAGE_APPLICATIONS (512) may read the privacy erasure audit trail.
-- Inserts are performed by the SECURITY DEFINER log_privacy_erasure_event helper
-- (called from the immutability trigger), not via RLS.
CREATE POLICY "privacy_erasure_events_permission_select" ON "privacy_erasure_events"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."has_permission"(512)));
--> statement-breakpoint
GRANT SELECT ON "public"."privacy_erasure_events" TO "authenticated", "service_role";
--> statement-breakpoint
-- Internal audit helper: metadata only, never stores original PII values.
CREATE OR REPLACE FUNCTION "public"."log_privacy_erasure_event"(
  p_table_name text,
  p_row_id uuid,
  p_operation text,
  p_redacted_columns text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor text;
BEGIN
  actor := current_setting('app.privacy_erasure_actor', true);
  INSERT INTO "public"."privacy_erasure_events" (
    "table_name", "row_id", "operation", "actor_identifier", "redacted_columns"
  ) VALUES (
    p_table_name,
    p_row_id,
    p_operation,
    NULLIF(actor, ''),
    p_redacted_columns
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."log_privacy_erasure_event"(text, uuid, text, text[]) FROM PUBLIC;
--> statement-breakpoint
-- Extend the append-only immutability guard to allow authorized privacy erasure.
-- Authorization is gated by the session GUC app.allow_privacy_erasure = 'true',
-- typically set via set_config(..., true) inside the SECURITY DEFINER procedures below.
CREATE OR REPLACE FUNCTION prevent_application_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  privacy_erasure_allowed boolean;
  redacted_columns text[];
BEGIN
  privacy_erasure_allowed := current_setting('app.allow_privacy_erasure', true) = 'true';

  IF TG_OP = 'DELETE' THEN
    IF privacy_erasure_allowed THEN
      IF TG_TABLE_NAME IN ('school_applications', 'staff_applications') THEN
        PERFORM "public"."log_privacy_erasure_event"(TG_TABLE_NAME, OLD.id, 'delete');
      END IF;
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Table % is immutable: DELETE operations are prohibited', TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'application_status_logs' THEN
      RAISE EXCEPTION 'Table application_status_logs is immutable: UPDATE operations are prohibited';
    ELSIF TG_TABLE_NAME = 'school_applications' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'School application id and submitted_at are immutable';
      END IF;
      IF privacy_erasure_allowed THEN
        redacted_columns := ARRAY[]::text[];
        IF NEW.applicant_name IS DISTINCT FROM OLD.applicant_name THEN
          redacted_columns := array_append(redacted_columns, 'applicant_name');
        END IF;
        IF NEW.school_name IS DISTINCT FROM OLD.school_name THEN
          redacted_columns := array_append(redacted_columns, 'school_name');
        END IF;
        IF NEW.role IS DISTINCT FROM OLD.role THEN
          redacted_columns := array_append(redacted_columns, 'role');
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
          redacted_columns := array_append(redacted_columns, 'email');
        END IF;
        IF NEW.message IS DISTINCT FROM OLD.message THEN
          redacted_columns := array_append(redacted_columns, 'message');
        END IF;
        IF NEW.details IS DISTINCT FROM OLD.details THEN
          redacted_columns := array_append(redacted_columns, 'details');
        END IF;
        IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
          redacted_columns := array_append(redacted_columns, 'deleted_at');
        END IF;
        IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
          redacted_columns := array_append(redacted_columns, 'deleted_by');
        END IF;
        IF array_length(redacted_columns, 1) IS NOT NULL THEN
          PERFORM "public"."log_privacy_erasure_event"(TG_TABLE_NAME, OLD.id, 'redact', redacted_columns);
        END IF;
        RETURN NEW;
      ELSIF NEW.applicant_name IS DISTINCT FROM OLD.applicant_name OR
            NEW.school_name IS DISTINCT FROM OLD.school_name OR
            NEW.role IS DISTINCT FROM OLD.role OR
            NEW.email IS DISTINCT FROM OLD.email OR
            NEW.message IS DISTINCT FROM OLD.message OR
            NEW.details IS DISTINCT FROM OLD.details THEN
        RAISE EXCEPTION 'School application submission fields are immutable';
      END IF;
    ELSIF TG_TABLE_NAME = 'staff_applications' THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Staff application id and submitted_at are immutable';
      END IF;
      IF privacy_erasure_allowed THEN
        redacted_columns := ARRAY[]::text[];
        IF NEW.name IS DISTINCT FROM OLD.name THEN
          redacted_columns := array_append(redacted_columns, 'name');
        END IF;
        IF NEW.preferred_first_name IS DISTINCT FROM OLD.preferred_first_name THEN
          redacted_columns := array_append(redacted_columns, 'preferred_first_name');
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
          redacted_columns := array_append(redacted_columns, 'email');
        END IF;
        IF NEW.phone IS DISTINCT FROM OLD.phone THEN
          redacted_columns := array_append(redacted_columns, 'phone');
        END IF;
        IF NEW.discord_tag IS DISTINCT FROM OLD.discord_tag THEN
          redacted_columns := array_append(redacted_columns, 'discord_tag');
        END IF;
        IF NEW.role IS DISTINCT FROM OLD.role THEN
          redacted_columns := array_append(redacted_columns, 'role');
        END IF;
        IF NEW.message IS DISTINCT FROM OLD.message THEN
          redacted_columns := array_append(redacted_columns, 'message');
        END IF;
        IF NEW.details IS DISTINCT FROM OLD.details THEN
          redacted_columns := array_append(redacted_columns, 'details');
        END IF;
        IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
          redacted_columns := array_append(redacted_columns, 'deleted_at');
        END IF;
        IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
          redacted_columns := array_append(redacted_columns, 'deleted_by');
        END IF;
        IF array_length(redacted_columns, 1) IS NOT NULL THEN
          PERFORM "public"."log_privacy_erasure_event"(TG_TABLE_NAME, OLD.id, 'redact', redacted_columns);
        END IF;
        RETURN NEW;
      ELSIF NEW.name IS DISTINCT FROM OLD.name OR
            NEW.preferred_first_name IS DISTINCT FROM OLD.preferred_first_name OR
            NEW.email IS DISTINCT FROM OLD.email OR
            NEW.phone IS DISTINCT FROM OLD.phone OR
            NEW.discord_tag IS DISTINCT FROM OLD.discord_tag OR
            NEW.role IS DISTINCT FROM OLD.role OR
            NEW.message IS DISTINCT FROM OLD.message OR
            NEW.details IS DISTINCT FROM OLD.details THEN
        RAISE EXCEPTION 'Staff application submission fields are immutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- Supported call path for school application privacy erasure/redaction.
CREATE OR REPLACE FUNCTION "public"."erase_school_application_privacy"(
  p_application_id uuid,
  p_actor text,
  p_operation text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_operation NOT IN ('redact', 'delete') THEN
    RAISE EXCEPTION 'Invalid privacy erasure operation: %', p_operation;
  END IF;

  PERFORM set_config('app.allow_privacy_erasure', 'true', true);
  PERFORM set_config('app.privacy_erasure_actor', p_actor, true);

  DELETE FROM "public"."application_status_logs"
  WHERE "application_id" = p_application_id
    AND "application_type" = 'school';

  IF p_operation = 'redact' THEN
    UPDATE "public"."school_applications"
    SET
      "applicant_name" = '',
      "school_name" = '',
      "role" = '',
      "email" = '',
      "message" = '',
      "details" = NULL,
      "deleted_at" = now(),
      "deleted_by" = p_actor
    WHERE "id" = p_application_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'School application not found: %', p_application_id;
    END IF;
  ELSE
    DELETE FROM "public"."school_applications"
    WHERE "id" = p_application_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'School application not found: %', p_application_id;
    END IF;
  END IF;

  PERFORM set_config('app.allow_privacy_erasure', '', true);
  PERFORM set_config('app.privacy_erasure_actor', '', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.allow_privacy_erasure', '', true);
    PERFORM set_config('app.privacy_erasure_actor', '', true);
    RAISE;
END;
$$;
--> statement-breakpoint
-- Supported call path for staff application privacy erasure/redaction.
CREATE OR REPLACE FUNCTION "public"."erase_staff_application_privacy"(
  p_application_id uuid,
  p_actor text,
  p_operation text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_operation NOT IN ('redact', 'delete') THEN
    RAISE EXCEPTION 'Invalid privacy erasure operation: %', p_operation;
  END IF;

  PERFORM set_config('app.allow_privacy_erasure', 'true', true);
  PERFORM set_config('app.privacy_erasure_actor', p_actor, true);

  DELETE FROM "public"."application_status_logs"
  WHERE "application_id" = p_application_id
    AND "application_type" = 'staff';

  IF p_operation = 'redact' THEN
    UPDATE "public"."staff_applications"
    SET
      "name" = '',
      "preferred_first_name" = NULL,
      "email" = '',
      "phone" = '',
      "discord_tag" = NULL,
      "role" = '',
      "message" = '',
      "details" = NULL,
      "deleted_at" = now(),
      "deleted_by" = p_actor
    WHERE "id" = p_application_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staff application not found: %', p_application_id;
    END IF;
  ELSE
    DELETE FROM "public"."staff_applications"
    WHERE "id" = p_application_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staff application not found: %', p_application_id;
    END IF;
  END IF;

  PERFORM set_config('app.allow_privacy_erasure', '', true);
  PERFORM set_config('app.privacy_erasure_actor', '', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.allow_privacy_erasure', '', true);
    PERFORM set_config('app.privacy_erasure_actor', '', true);
    RAISE;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."erase_school_application_privacy"(uuid, text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."erase_staff_application_privacy"(uuid, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."erase_school_application_privacy"(uuid, text, text) TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."erase_staff_application_privacy"(uuid, text, text) TO "service_role";