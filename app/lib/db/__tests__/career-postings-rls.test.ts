import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Permissions } from '@/app/lib/roles';
import { extractTablesFromSql } from '../../../../db/migrate-tables';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');
const metaDir = resolve(migrationsDir, 'meta');
const migrationPath = resolve(migrationsDir, '0047_career_postings_rls.sql');
const journalPath = resolve(metaDir, '_journal.json');

describe('Career postings RLS migration (0047)', () => {
  it('migration file exists and is registered in _journal.json after 0045 with a matching idx', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { idx: number; tag: string; when: number }[];
    };
    const tags = journal.entries.map((e) => e.tag);
    const idx0045 = tags.indexOf('0045_career_postings');
    const idx0047 = tags.indexOf('0047_career_postings_rls');

    expect(idx0045).toBeGreaterThanOrEqual(0);
    expect(idx0047).toBeGreaterThan(idx0045);

    const entry0047 = journal.entries[idx0047];
    expect(entry0047.idx).toBe(47);
    // drizzle applies migrations by `when`, so it must exceed every earlier entry
    for (const earlier of journal.entries.slice(0, idx0047)) {
      expect(entry0047.when).toBeGreaterThan(earlier.when);
    }
    expect(entry0047.tag).toBe('0047_career_postings_rls');
  });

  it('explicitly enables Row Level Security on career_postings', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE "career_postings" ENABLE ROW LEVEL SECURITY;');
  });

  it('defines all 4 policies matching MANAGE_APPLICATIONS permission (512)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const manageApplicationsValue = Number(Permissions.MANAGE_APPLICATIONS);
    expect(manageApplicationsValue).toBe(512);

    // SELECT policy allows anon/authenticated to view published non-deleted postings OR staff with permission 512
    expect(sql).toContain('CREATE POLICY "career_postings_public_or_permission_select" ON "public"."career_postings"');
    expect(sql).toMatch(
      /CREATE POLICY "career_postings_public_or_permission_select" ON "public"."career_postings"\s+FOR SELECT TO "anon", "authenticated"\s+USING \(\("status" = 'published' AND "deleted_at" IS NULL\) OR \(SELECT "public"\."has_permission"\(512\)\)\);/
    );

    // INSERT policy allows authenticated with permission 512
    expect(sql).toContain('CREATE POLICY "career_postings_permission_insert" ON "public"."career_postings"');
    expect(sql).toMatch(
      /CREATE POLICY "career_postings_permission_insert" ON "public"."career_postings"\s+FOR INSERT TO "authenticated" WITH CHECK \(\(SELECT "public"\."has_permission"\(512\)\)\);/
    );

    // UPDATE policy allows authenticated with permission 512
    expect(sql).toContain('CREATE POLICY "career_postings_permission_update" ON "public"."career_postings"');
    expect(sql).toMatch(
      /CREATE POLICY "career_postings_permission_update" ON "public"."career_postings"\s+FOR UPDATE TO "authenticated"\s+USING \(\(SELECT "public"\."has_permission"\(512\)\)\)\s+WITH CHECK \(\(SELECT "public"\."has_permission"\(512\)\)\);/
    );

    // DELETE policy allows authenticated with permission 512
    expect(sql).toContain('CREATE POLICY "career_postings_permission_delete" ON "public"."career_postings"');
    expect(sql).toMatch(
      /CREATE POLICY "career_postings_permission_delete" ON "public"."career_postings"\s+FOR DELETE TO "authenticated"\s+USING \(\(SELECT "public"\."has_permission"\(512\)\)\);/
    );
  });

  it('grants appropriate table permissions to anon, authenticated, and service_role', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('GRANT SELECT ON "public"."career_postings" TO "anon", "authenticated", "service_role";');
    expect(sql).toContain('GRANT INSERT, UPDATE, DELETE ON "public"."career_postings" TO "authenticated", "service_role";');
  });

  it('is recognized by extractTablesFromSql for migration backup scope calculation', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    // Anchored pass recognizes ALTER TABLE "career_postings" without needing realTables
    const anchoredTables = extractTablesFromSql(sql, new Set());
    expect(anchoredTables.has('career_postings')).toBe(true);

    // Catch-all pass with real tables also includes career_postings
    const scopedTables = extractTablesFromSql(sql, new Set(['career_postings', 'other_table']));
    expect(scopedTables).toEqual(new Set(['career_postings']));
  });
});
