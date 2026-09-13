import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as schema from '@/app/lib/db/schema';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');
const metaDir = resolve(migrationsDir, 'meta');

const migration0035 = readFileSync(
  resolve(migrationsDir, '0035_allow_authorized_privacy_erasure.sql'),
  'utf8'
);
const journal = JSON.parse(readFileSync(resolve(metaDir, '_journal.json'), 'utf8')) as {
  entries: { tag: string }[];
};
const snapshot0034 = JSON.parse(
  readFileSync(resolve(metaDir, '0034_snapshot.json'), 'utf8')
) as { id: string };
const snapshot0035 = JSON.parse(
  readFileSync(resolve(metaDir, '0035_snapshot.json'), 'utf8')
) as { id: string; prevId: string };

describe('Privacy erasure migration (0035)', () => {
  describe('Schema definitions', () => {
    it('defines privacyErasureEvents with metadata columns only, no PII payload fields', () => {
      const columns = schema.privacyErasureEvents;
      expect(columns.id).toBeDefined();
      expect(columns.tableName).toBeDefined();
      expect(columns.rowId).toBeDefined();
      expect(columns.operation).toBeDefined();
      expect(columns.actorIdentifier).toBeDefined();
      expect(columns.redactedColumns).toBeDefined();
      expect(columns.createdAt).toBeDefined();

      const columnNames = Object.keys(columns);
      expect(columnNames).not.toContain('email');
      expect(columnNames).not.toContain('applicantName');
      expect(columnNames).not.toContain('message');
      expect(columnNames).not.toContain('details');
      expect(columnNames).not.toContain('phone');
      expect(columnNames).not.toContain('discordTag');
    });
  });

  describe('Drizzle journal and snapshot chain', () => {
    it('appends 0035_allow_authorized_privacy_erasure to the journal', () => {
      const tags = journal.entries.map((entry) => entry.tag);
      expect(tags).toContain('0035_allow_authorized_privacy_erasure');
      expect(tags.at(-1)).toBe('0035_allow_authorized_privacy_erasure');
    });

    it('links 0035 snapshot prevId to 0034 snapshot id', () => {
      expect(snapshot0035.prevId).toBe(snapshot0034.id);
      expect(snapshot0035.id).not.toBe(snapshot0034.id);
    });
  });

  describe('prevent_application_mutation() trigger function', () => {
    it('still raises on unauthorized DELETE', () => {
      expect(migration0035).toContain(
        "RAISE EXCEPTION 'Table % is immutable: DELETE operations are prohibited', TG_TABLE_NAME"
      );
    });

    it('still raises on unauthorized school application PII UPDATE', () => {
      expect(migration0035).toContain(
        "RAISE EXCEPTION 'School application submission fields are immutable'"
      );
    });

    it('still raises on unauthorized staff application PII UPDATE', () => {
      expect(migration0035).toContain(
        "RAISE EXCEPTION 'Staff application submission fields are immutable'"
      );
    });

    it('still raises on application_status_logs UPDATE even when erasure is authorized', () => {
      expect(migration0035).toContain(
        "RAISE EXCEPTION 'Table application_status_logs is immutable: UPDATE operations are prohibited'"
      );
    });

    it('checks app.allow_privacy_erasure GUC with missing_ok', () => {
      expect(migration0035).toContain(
        "current_setting('app.allow_privacy_erasure', true) = 'true'"
      );
    });

    it('returns OLD on authorized DELETE and logs audit for application tables only', () => {
      expect(migration0035).toMatch(
        /IF TG_OP = 'DELETE' THEN[\s\S]*IF privacy_erasure_allowed THEN[\s\S]*log_privacy_erasure_event[\s\S]*RETURN OLD;/
      );
      expect(migration0035).toMatch(
        /TG_TABLE_NAME IN \('school_applications', 'staff_applications'\)/
      );
    });

    it('still rejects id and submitted_at changes when privacy erasure is authorized', () => {
      expect(migration0035).toContain(
        "RAISE EXCEPTION 'School application id and submitted_at are immutable'"
      );
      expect(migration0035).toContain(
        "RAISE EXCEPTION 'Staff application id and submitted_at are immutable'"
      );
    });

    it('logs redact audit from trigger when authorized UPDATE changes PII or soft-delete columns', () => {
      expect(migration0035).toContain('"public"."log_privacy_erasure_event"');
      expect(migration0035).toMatch(
        /IF privacy_erasure_allowed THEN[\s\S]*redacted_columns[\s\S]*log_privacy_erasure_event[\s\S]*'redact'/
      );
      expect(migration0035).toContain("current_setting('app.privacy_erasure_actor', true)");
    });

    it('is SECURITY DEFINER with empty search_path so it can call the internal audit helper', () => {
      expect(migration0035).toMatch(
        /CREATE OR REPLACE FUNCTION prevent_application_mutation\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/
      );
    });
  });

  describe('log_privacy_erasure_event helper access control', () => {
    it('revokes the helper from PUBLIC without granting EXECUTE to service_role', () => {
      expect(migration0035).toContain(
        'REVOKE ALL ON FUNCTION "public"."log_privacy_erasure_event"(text, uuid, text, text[]) FROM PUBLIC'
      );
      expect(migration0035).not.toContain(
        'GRANT EXECUTE ON FUNCTION "public"."log_privacy_erasure_event"'
      );
    });
  });

  describe('SECURITY DEFINER erasure procedures', () => {
    it('defines erase_school_application_privacy and erase_staff_application_privacy', () => {
      expect(migration0035).toContain('"public"."erase_school_application_privacy"');
      expect(migration0035).toContain('"public"."erase_staff_application_privacy"');
    });

    it('sets session GUCs via set_config before mutating data', () => {
      expect(migration0035).toContain(
        "set_config('app.allow_privacy_erasure', 'true', true)"
      );
      expect(migration0035).toContain(
        "set_config('app.privacy_erasure_actor', p_actor, true)"
      );
    });

    it('deletes application_status_logs as part of erasure without copying reason into audit', () => {
      expect(migration0035).toContain('DELETE FROM "public"."application_status_logs"');
      expect(migration0035).not.toContain('OLD.reason');
      expect(migration0035).not.toContain('"reason"');
    });

    it('resets transaction-local GUCs after success and on exception', () => {
      const schoolProcedure = migration0035.slice(
        migration0035.indexOf('"public"."erase_school_application_privacy"'),
        migration0035.indexOf('"public"."erase_staff_application_privacy"')
      );
      const staffProcedure = migration0035.slice(
        migration0035.indexOf('"public"."erase_staff_application_privacy"'),
        migration0035.indexOf('REVOKE ALL ON FUNCTION "public"."erase_school_application_privacy"')
      );

      for (const procedure of [schoolProcedure, staffProcedure]) {
        expect(procedure).toContain("set_config('app.allow_privacy_erasure', '', true)");
        expect(procedure).toContain("set_config('app.privacy_erasure_actor', '', true)");
        expect(procedure).toMatch(/EXCEPTION[\s\S]*set_config\('app\.allow_privacy_erasure', '', true\)[\s\S]*RAISE;/);
      }
    });

    it('does not duplicate audit inserts in procedures (trigger logs once)', () => {
      const schoolProcedure = migration0035.slice(
        migration0035.indexOf('"public"."erase_school_application_privacy"'),
        migration0035.indexOf('"public"."erase_staff_application_privacy"')
      );
      const staffProcedure = migration0035.slice(
        migration0035.indexOf('"public"."erase_staff_application_privacy"'),
        migration0035.indexOf('REVOKE ALL ON FUNCTION "public"."erase_school_application_privacy"')
      );

      expect(schoolProcedure).not.toContain('INSERT INTO "public"."privacy_erasure_events"');
      expect(staffProcedure).not.toContain('INSERT INTO "public"."privacy_erasure_events"');
    });

    it('audit helper stores metadata only, not original PII column values', () => {
      const auditHelper = migration0035.slice(
        migration0035.indexOf('"public"."log_privacy_erasure_event"'),
        migration0035.indexOf('REVOKE ALL ON FUNCTION "public"."log_privacy_erasure_event"')
      );

      expect(auditHelper).toContain('INSERT INTO "public"."privacy_erasure_events"');
      expect(auditHelper).not.toContain('OLD.email');
      expect(auditHelper).not.toContain('OLD.applicant_name');
      expect(auditHelper).not.toContain('OLD.message');
      expect(auditHelper).not.toContain('OLD.details');
      expect(migration0035).toContain("'redact'");
      expect(migration0035).toContain("'delete'");
      expect(migration0035).toContain('"redacted_columns"');
    });

    it('redacts PII to empty strings or null and soft-deletes the row', () => {
      expect(migration0035).toContain('"applicant_name" = \'\'');
      expect(migration0035).toContain('"details" = NULL');
      expect(migration0035).toContain('"preferred_first_name" = NULL');
      expect(migration0035).toContain('"deleted_at" = now()');
      expect(migration0035).toContain('"deleted_by" = p_actor');
    });

    it('grants execute on procedures to service_role only', () => {
      expect(migration0035).toContain(
        'GRANT EXECUTE ON FUNCTION "public"."erase_school_application_privacy"(uuid, text, text) TO "service_role"'
      );
      expect(migration0035).toContain(
        'GRANT EXECUTE ON FUNCTION "public"."erase_staff_application_privacy"(uuid, text, text) TO "service_role"'
      );
    });
  });

  describe('privacy_erasure_events table and RLS', () => {
    it('creates the audit table with operation check constraint', () => {
      expect(migration0035).toContain('CREATE TABLE "privacy_erasure_events"');
      expect(migration0035).toContain(
        "CHECK (\"privacy_erasure_events\".\"operation\" IN ('redact', 'delete'))"
      );
    });

    it('adds SELECT policy for MANAGE_APPLICATIONS permission (512)', () => {
      expect(migration0035).toContain('"privacy_erasure_events_permission_select"');
      expect(migration0035).toContain('"public"."has_permission"(512)');
    });
  });
});
