import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as schema from '@/app/lib/db/schema';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');
const metaDir = resolve(migrationsDir, 'meta');
const migration = readFileSync(resolve(migrationsDir, '0036_staff_application_resume.sql'), 'utf8');
const journal = JSON.parse(readFileSync(resolve(metaDir, '_journal.json'), 'utf8')) as {
  entries: { tag: string }[];
};
const snapshot0035 = JSON.parse(readFileSync(resolve(metaDir, '0035_snapshot.json'), 'utf8')) as { id: string };
const snapshot0036 = JSON.parse(readFileSync(resolve(metaDir, '0036_snapshot.json'), 'utf8')) as {
  id: string;
  prevId: string;
};

describe('Staff application resume migration (0036)', () => {
  it('adds a nullable resume_storage_key column that the schema maps', () => {
    expect(migration).toContain('ALTER TABLE "staff_applications" ADD COLUMN "resume_storage_key" text;');
    expect(schema.staffApplications.resumeStorageKey).toBeDefined();
    expect(schema.staffApplications.resumeStorageKey.notNull).toBe(false);
  });

  it('follows 0035 in the journal and snapshot chain', () => {
    const tags = journal.entries.map((e) => e.tag);
    expect(tags.indexOf('0036_staff_application_resume')).toBe(
      tags.indexOf('0035_allow_authorized_privacy_erasure') + 1,
    );
    expect(snapshot0036.prevId).toBe(snapshot0035.id);
  });

  it('keeps resume_storage_key immutable outside an authorized erasure', () => {
    expect(migration).toMatch(
      /NEW\.resume_storage_key IS DISTINCT FROM OLD\.resume_storage_key THEN\s+RAISE EXCEPTION 'Staff application submission fields are immutable'/,
    );
    expect(migration).toContain("redacted_columns := array_append(redacted_columns, 'resume_storage_key')");
    expect(migration).toContain("current_setting('app.allow_privacy_erasure', true) = 'true'");
  });

  it('clears resume_storage_key when a staff application is redacted', () => {
    const proc = migration.slice(migration.indexOf('"public"."erase_staff_application_privacy"'));
    expect(proc).toContain('"resume_storage_key" = NULL');
  });
});
