import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { extractTablesFromSql } from '../migrate-tables';
import { determineScope } from '../migrate';

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

// determineScope() is the actual decision tree this feature's safety property
// rests on. It takes an optional `sql` override (a fake tagged-template
// function standing in for a real `postgres(url, { max: 1 })` connection) and
// an optional `{ migrationsDir, journalPath }` override, so every branch below
// runs against fake journal/migration files in a temp dir with no live
// Postgres connection — see db/migrate.ts's determineScope() doc comment for
// why the overrides exist and what main() does differently (nothing: it calls
// determineScope() with no arguments, which is untouched).
describe('determineScope', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'migrate-scope-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function paths() {
    return { migrationsDir: dir, journalPath: join(dir, '_journal.json') };
  }

  function writeJournal(entries: { idx: number; when: number; tag: string }[]) {
    writeFileSync(join(dir, '_journal.json'), JSON.stringify({ entries }));
  }

  function writeMigration(tag: string, sql: string) {
    writeFileSync(join(dir, `${tag}.sql`), sql);
  }

  // determineScope()'s sql param is typed as a real postgres.js `Sql<{}>`
  // connection, which carries many properties (`end`, `unsafe`, `json`, ...)
  // this fake never needs — it only ever gets called as a tagged template for
  // the two specific queries determineScope() issues. `ScopeSqlClient` names
  // that real type without exporting it from db/migrate.ts, purely so the
  // fake below can be cast to it once instead of at every call site.
  type ScopeSqlClient = NonNullable<Parameters<typeof determineScope>[0]>;

  /**
   * Fake `sql<T>\`...\`` tagged-template client dispatching on query text —
   * exactly the two queries determineScope() issues, distinguished the same
   * way a real postgres.js connection would answer them. Configure per test
   * with `rows` (resolves) or `error` (rejects) for either query; an
   * unconfigured query resolves to zero rows, matching a real empty result set.
   */
  function fakeSql(config: {
    appliedMax?: { rows?: { applied: string | null }[]; error?: unknown };
    realTables?: { rows?: { tablename: string }[]; error?: unknown };
  }): ScopeSqlClient {
    const impl = async (strings: TemplateStringsArray) => {
      const text = strings.join(' ');
      if (text.includes('__drizzle_migrations')) {
        if (config.appliedMax?.error) throw config.appliedMax.error;
        return config.appliedMax?.rows ?? [];
      }
      if (text.includes('pg_tables')) {
        if (config.realTables?.error) throw config.realTables.error;
        return config.realTables?.rows ?? [];
      }
      throw new Error(`fakeSql: unexpected query: ${text}`);
    };
    return impl as unknown as ScopeSqlClient;
  }

  const undefinedTableError = () => ({
    code: '42P01',
    message: 'relation "drizzle.__drizzle_migrations" does not exist',
  });
  const connectionError = () => Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });

  it('treats a 42P01 tracking-table error as "no migrations ever applied", not a fallback trigger', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    writeMigration('m0', 'ALTER TABLE "members" ADD COLUMN "x" text;');
    const sql = fakeSql({
      appliedMax: { error: undefinedTableError() },
      realTables: { rows: [{ tablename: 'members' }] },
    });
    // If 42P01 were mistaken for a fallback trigger, this would come back
    // 'full' instead of proceeding to compute pending from the whole journal.
    await expect(determineScope(sql, paths())).resolves.toEqual(['members']);
  });

  it('falls back to full on any other tracking-table query error', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    writeMigration('m0', 'ALTER TABLE "members" ADD COLUMN "x" text;');
    const sql = fakeSql({ appliedMax: { error: connectionError() } });
    await expect(determineScope(sql, paths())).resolves.toBe('full');
  });

  it('falls back to full when the pending list comes back empty', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    writeMigration('m0', 'ALTER TABLE "members" ADD COLUMN "x" text;');
    // appliedMax = 1, journal's only entry is also `when: 1` — not > appliedMax.
    const sql = fakeSql({ appliedMax: { rows: [{ applied: '1' }] } });
    await expect(determineScope(sql, paths())).resolves.toBe('full');
  });

  it('falls back to full when the pg_tables query throws', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    writeMigration('m0', 'ALTER TABLE "members" ADD COLUMN "x" text;');
    const sql = fakeSql({
      appliedMax: { rows: [{ applied: null }] },
      realTables: { error: new Error('permission denied for table pg_tables') },
    });
    await expect(determineScope(sql, paths())).resolves.toBe('full');
  });

  it('falls back to full when extraction finds zero table names in the pending migrations', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    // No CREATE/ALTER/DROP TABLE, and no quoted identifier at all.
    writeMigration('m0', 'SELECT 1;');
    const sql = fakeSql({
      appliedMax: { rows: [{ applied: null }] },
      realTables: { rows: [{ tablename: 'members' }] },
    });
    await expect(determineScope(sql, paths())).resolves.toBe('full');
  });

  it('falls back to full when extracted tables filter to nothing but the database is not empty', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    // Only touches a table that doesn't exist yet; "members" exists but isn't touched.
    writeMigration('m0', 'CREATE TABLE "widgets" ("id" uuid);');
    const sql = fakeSql({
      appliedMax: { rows: [{ applied: null }] },
      realTables: { rows: [{ tablename: 'members' }] },
    });
    await expect(determineScope(sql, paths())).resolves.toBe('full');
  });

  it('returns empty-database when extracted tables filter to nothing and the database has zero tables', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    writeMigration('m0', 'CREATE TABLE "widgets" ("id" uuid);');
    const sql = fakeSql({
      appliedMax: { rows: [{ applied: null }] },
      realTables: { rows: [] },
    });
    await expect(determineScope(sql, paths())).resolves.toBe('empty-database');
  });

  it('returns exactly the existing-table subset, not the full extracted set and not full', async () => {
    writeJournal([{ idx: 0, when: 1, tag: 'm0' }]);
    // Touches an existing table (members) and a brand-new one (widgets).
    writeMigration(
      'm0',
      'ALTER TABLE "members" ADD COLUMN "x" text;\nCREATE TABLE "widgets" ("id" uuid);'
    );
    const sql = fakeSql({
      appliedMax: { rows: [{ applied: null }] },
      realTables: { rows: [{ tablename: 'members' }] }, // widgets doesn't exist yet
    });
    await expect(determineScope(sql, paths())).resolves.toEqual(['members']);
  });

  it('excludes a journal entry whose `when` exactly equals appliedMax (strictly-greater-than boundary)', async () => {
    writeJournal([
      { idx: 0, when: 5, tag: 'already_applied' },
      { idx: 1, when: 6, tag: 'still_pending' },
    ]);
    // If `when === appliedMax` were wrongly treated as pending, this file
    // would get read and "skip_table" would leak into the result.
    writeMigration('already_applied', 'CREATE TABLE "skip_table" ("id" uuid);');
    writeMigration('still_pending', 'ALTER TABLE "members" ADD COLUMN "x" text;');
    const sql = fakeSql({
      appliedMax: { rows: [{ applied: '5' }] },
      realTables: { rows: [{ tablename: 'members' }, { tablename: 'skip_table' }] },
    });
    await expect(determineScope(sql, paths())).resolves.toEqual(['members']);
  });
});
