import { describe, expect, it } from 'vitest';
import { buildStaffResumeKeyQuery } from '@/app/lib/db/queries';

/**
 * Asserts the SQL drizzle generates for the admin resume lookup (no database
 * involved). The soft-delete filter is what stops a removed application's
 * resume from being opened, so it is checked on the real query, not a mock.
 */
describe('buildStaffResumeKeyQuery', () => {
  const id = '0b6f8a2e-4f1c-4a8e-9a53-0d1b2c3d4e5f';
  const { sql, params } = buildStaffResumeKeyQuery(id).toSQL();

  it('selects only the resume key from staff_applications', () => {
    expect(sql).toMatch(/^select "resume_storage_key" from "staff_applications"/);
  });

  it('matches the id AND excludes soft-deleted rows', () => {
    expect(sql).toContain('where ("staff_applications"."id" = $1 and "staff_applications"."deleted_at" is null)');
    expect(params[0]).toBe(id);
  });

  it('returns at most one row', () => {
    expect(sql).toMatch(/limit \$2$/);
    expect(params[1]).toBe(1);
  });
});
