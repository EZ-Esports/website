import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractTablesFromSql } from '../migrate-tables';

describe('extractTablesFromSql', () => {
  it('extracts tables from CREATE/ALTER TABLE via the anchored pass alone', () => {
    const sql = `
      CREATE TABLE "leadership_terms" ("id" uuid PRIMARY KEY);
      ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_person_id_people_id_fk"
        FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");
    `;
    // realTables intentionally empty: the anchored pass must not depend on it.
    expect(extractTablesFromSql(sql, new Set())).toEqual(new Set(['leadership_terms']));
  });

  it('matches the real migration 0032_nappy_blade.sql exactly (leadership_terms, people)', () => {
    const sql = readFileSync(
      resolve(__dirname, '..', 'migrations', '0032_nappy_blade.sql'),
      'utf8'
    );
    expect(extractTablesFromSql(sql, new Set())).toEqual(new Set(['leadership_terms', 'people']));
  });

  it('does not anchor on a schema-qualified FK REFERENCES target', () => {
    const sql = `ALTER TABLE "people" ADD CONSTRAINT "x" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id");`;
    // "people" is the anchored ALTER TABLE target; "members" only appears
    // schema-qualified inside REFERENCES, which the anchored pass must not match.
    expect(extractTablesFromSql(sql, new Set())).toEqual(new Set(['people']));
  });

  it('handles CREATE TABLE IF NOT EXISTS', () => {
    const sql = `CREATE TABLE IF NOT EXISTS "foo" ("id" uuid);`;
    expect(extractTablesFromSql(sql, new Set())).toEqual(new Set(['foo']));
  });

  it('handles DROP TABLE', () => {
    const sql = `DROP TABLE "old_table";`;
    expect(extractTablesFromSql(sql, new Set())).toEqual(new Set(['old_table']));
  });

  // The catch-all pass exists for exactly this: a migration with no
  // CREATE/ALTER/DROP TABLE at all, which the anchored pass alone would
  // completely miss.
  it('catches a DML-only migration via the catch-all pass, given the real table name', () => {
    const sql = `UPDATE "members" SET "graduation_year" = 2026 WHERE "graduation_year" IS NULL;`;
    const realTables = new Set(['members', 'schools', 'games']);
    expect(extractTablesFromSql(sql, realTables)).toEqual(new Set(['members']));
  });

  it('finds nothing from a DML-only migration when given no matching real tables', () => {
    const sql = `UPDATE "members" SET "graduation_year" = 2026;`;
    expect(extractTablesFromSql(sql, new Set(['schools', 'games']))).toEqual(new Set());
  });

  // The catch-all pass alone (unfiltered) also matches column, constraint, and
  // index names — this is the noise the realTables filter exists to remove.
  it('filters catch-all matches down to real table names, dropping column/constraint/index noise', () => {
    const sql = `
      UPDATE "members" SET "person_id" = NULL;
      CREATE INDEX "leadership_terms_year_idx" ON "leadership_terms" USING btree ("year");
    `;
    const realTables = new Set(['members', 'leadership_terms']);
    const found = extractTablesFromSql(sql, realTables);
    // Real tables are found...
    expect(found.has('members')).toBe(true);
    expect(found.has('leadership_terms')).toBe(true);
    // ...but the column and index-name noise is not.
    expect(found.has('person_id')).toBe(false);
    expect(found.has('leadership_terms_year_idx')).toBe(false);
    expect(found).toEqual(new Set(['members', 'leadership_terms']));
  });

  it('is fine (over-inclusive in the safe direction) picking up an FK-referenced table not itself mutated', () => {
    const sql = `ALTER TABLE "people" ADD CONSTRAINT "x" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id");`;
    // Unlike the anchored-only test above, this time "members" IS a real table,
    // so the catch-all pass is allowed to pick it up even though it's only
    // referenced, not the table being altered. Over-inclusion, not a bug.
    const realTables = new Set(['people', 'members']);
    const found = extractTablesFromSql(sql, realTables);
    expect(found.has('people')).toBe(true);
    expect(found.has('members')).toBe(true);
  });

  it('returns an empty set for SQL with no table references at all', () => {
    expect(extractTablesFromSql('SELECT 1;', new Set(['members']))).toEqual(new Set());
  });
});
