/**
 * Pre-migration backup guard. `db:seed` and `db:seed:gold` already refuse to
 * run without a fresh backup (db/backup.ts) — this closes the same gap for
 * `db:migrate`, which had none. Same fail-closed, no-bypass shape.
 *
 * Scope is determined by diffing Drizzle's migration-tracking table against
 * db/migrations/meta/_journal.json to find pending migration files, then
 * regexing those files for the tables they touch. Any step that can't
 * proceed with confidence falls back to a full `--schema=public` dump — a
 * bigger dump than necessary is fine, backing up the wrong tables (or none)
 * is not.
 */
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { requireFreshBackup } from './backup';
import { extractTablesFromSql } from './migrate-tables';

const MIGRATIONS_DIR = resolve(process.cwd(), 'db/migrations');
const JOURNAL_PATH = resolve(MIGRATIONS_DIR, 'meta/_journal.json');

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '42P01'
  );
}

function readJournalEntries(journalPath: string = JOURNAL_PATH): JournalEntry[] {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: JournalEntry[] };
  return journal.entries;
}

/** `'empty-database'`: the public schema is verified empty — nothing to back up. `'full'`: scope couldn't be confidently narrowed down. */
export type Scope = readonly string[] | 'full' | 'empty-database';

/** Connection shape determineScope() needs — lets tests pass a mock instead of a live Postgres. */
type SqlClient = ReturnType<typeof postgres>;

/**
 * Determines the backup scope for the migration about to run. `sqlOverride`/
 * `pathsOverride` exist for unit testing without a live connection or the
 * real migrations directory; `main()` calls this with no arguments.
 */
export async function determineScope(
  sqlOverride?: SqlClient,
  pathsOverride?: { migrationsDir: string; journalPath: string }
): Promise<Scope> {
  const ownsConnection = sqlOverride === undefined;
  const url = process.env.DATABASE_URL ?? '';
  const sql = sqlOverride ?? postgres(url, { max: 1 });
  const migrationsDir = pathsOverride?.migrationsDir ?? MIGRATIONS_DIR;
  const journalPath = pathsOverride?.journalPath ?? JOURNAL_PATH;

  try {
    let appliedMax: number | null;
    try {
      const rows = await sql<{ applied: string | null }[]>`
        select max(created_at) as applied from drizzle.__drizzle_migrations
      `;
      const applied = rows[0]?.applied;
      appliedMax = applied === null || applied === undefined ? null : Number(applied);
    } catch (err) {
      if (isUndefinedTableError(err)) {
        // No migrations have ever applied — everything in the journal is pending.
        appliedMax = null;
      } else {
        console.warn(
          'db:migrate: could not read the migration-tracking table, falling back to a full backup.',
          err
        );
        return 'full';
      }
    }

    const entries = readJournalEntries(journalPath);
    const pending = entries
      .filter((e) => e.when > (appliedMax ?? -Infinity))
      .sort((a, b) => a.idx - b.idx);

    if (pending.length === 0) {
      console.warn('db:migrate: no pending migrations detected, falling back to a full backup.');
      return 'full';
    }

    let realTables: Set<string>;
    try {
      const rows = await sql<{ tablename: string }[]>`
        select tablename from pg_tables where schemaname = 'public'
      `;
      realTables = new Set(rows.map((r) => r.tablename));
    } catch (err) {
      console.warn(
        'db:migrate: could not read the list of real tables, falling back to a full backup.',
        err
      );
      return 'full';
    }

    const extracted = new Set<string>();
    for (const entry of pending) {
      const file = resolve(migrationsDir, `${entry.tag}.sql`);
      const text = readFileSync(file, 'utf8');
      for (const t of extractTablesFromSql(text, realTables)) extracted.add(t);
    }

    if (extracted.size === 0) {
      console.warn(
        'db:migrate: found pending migrations but no table names in them, falling back to a full backup.'
      );
      return 'full';
    }

    // A table a pending CREATE TABLE is about to create doesn't exist yet —
    // pg_dump --table errors on it, and there's no data in it to lose anyway.
    const existing = [...extracted].filter((t) => realTables.has(t));

    if (existing.length === 0) {
      if (realTables.size === 0) return 'empty-database';
      console.warn(
        'db:migrate: pending migrations only touch tables that do not exist yet, falling back to a full backup.'
      );
      return 'full';
    }

    return existing;
  } finally {
    if (ownsConnection) await sql.end({ timeout: 5 });
  }
}

async function main() {
  console.log('Determining pending-migration scope for the pre-migration backup...');
  const scope = await determineScope();

  if (scope === 'empty-database') {
    console.log('  scope: none — public schema has no tables yet, nothing to back up.');
  } else {
    console.log(scope === 'full' ? '  scope: full schema' : `  scope: ${scope.join(', ')}`);
    requireFreshBackup(scope);
  }

  console.log('Running drizzle-kit migrate...');
  const result = spawnSync(
    process.execPath,
    [resolve(process.cwd(), 'node_modules/drizzle-kit/bin.cjs'), 'migrate'],
    { stdio: 'inherit', env: process.env }
  );

  if (result.error) {
    console.error('Could not run drizzle-kit migrate:', result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

// Only run as a side effect of `npm run db:migrate` — not when imported for
// testing determineScope() (see db/__tests__/migrate.test.ts).
const isMainModule = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((err) => {
    console.error('Migrate guard failed:', err);
    process.exit(1);
  });
}
