/**
 * Pre-migration backup guard.
 *
 * `db:seed` and `db:seed:gold` have refused to run without a fresh backup
 * since db/backup.ts existed. `db:migrate` never did — it ran `drizzle-kit
 * migrate` directly, with zero backup coverage, even though a migration can
 * drop or alter a column just as destructively as either seed can delete a
 * row. This closes that gap: before a single migration statement executes,
 * take a backup scoped to the tables the pending migrations touch, and abort
 * the run if that backup fails for any reason. Same fail-closed, no-bypass
 * shape as `requireFreshBackup()`'s existing callers — see db/backup.ts.
 *
 * Scope is determined, not guessed, by diffing Drizzle's own migration-tracking
 * table against db/migrations/meta/_journal.json:
 *
 *   1. Read how many migrations have actually applied to this database
 *      (`drizzle.__drizzle_migrations`, the table drizzle-kit itself creates
 *      and maintains — see node_modules/drizzle-orm/pg-core/dialect.js).
 *   2. Diff against the journal to get the pending .sql files.
 *   3. Regex each pending file for the tables it touches: an anchored pass
 *      (CREATE/ALTER/DROP TABLE) trusted outright, plus a catch-all quoted-
 *      identifier pass filtered against the database's real table names, so a
 *      migration that is pure DML (no CREATE/ALTER/DROP TABLE at all) still
 *      gets caught.
 *   4. Back up exactly that table list.
 *
 * Every step above that cannot proceed with full confidence — the tracking
 * table is unreadable for a reason other than "no migrations have ever run",
 * the pending list comes back suspiciously empty, table extraction finds
 * nothing despite non-empty pending files — falls back to a full
 * `--schema=public` dump rather than guessing. A bigger dump than strictly
 * necessary is always fine; backing up the wrong tables, or none, is not.
 *
 * One real finding from exercising this against an actual fresh scratch
 * database: `pg_dump --table public.<name>` errors ("no matching tables were
 * found") for a table that does not exist yet — which every table a *pending*
 * `CREATE TABLE` migration is about to create necessarily does not, before
 * that migration runs. So the extracted table list is filtered down to tables
 * that already exist (queried the same way the catch-all regex pass's
 * filter is) before it is ever handed to dumpTables(). A brand-new table has
 * no pre-existing data to lose, so excluding it from the backup is correct,
 * not a gap — what the backup exists to protect is what is already there
 * that an ALTER/DROP (or an FK a new table adds) could touch. If that leaves
 * nothing — most commonly a database with zero tables at all, i.e. this is
 * the very first `db:migrate` run ever against it — there is provably
 * nothing to back up, verified by direct query rather than assumed. See
 * `determineScope()`'s `'empty-database'` outcome.
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

/**
 * `'empty-database'`: verified, not guessed — `pg_tables` came back with zero
 * rows, so there is provably no pre-existing data anywhere in `public` for a
 * backup to protect. Distinct from `'full'`, which means "back up everything
 * because we could not confidently narrow it down" — this instead means
 * "there is confidently nothing to back up." `main()` skips the backup step
 * entirely for this one outcome; every other outcome still goes through
 * `requireFreshBackup()`, no exceptions.
 */
export type Scope = readonly string[] | 'full' | 'empty-database';

/** The shape of a live `postgres(url, { max: 1 })` connection, exactly as
 * `determineScope()` calls it: two tagged-template queries. Exists so tests
 * can hand in a mock without a live Postgres — see
 * db/__tests__/migrate.test.ts. */
type SqlClient = ReturnType<typeof postgres>;

/**
 * Determines the backup scope for the migration about to run: a table list
 * when the pending migrations can be confidently identified and their
 * *currently-existing* tables confidently extracted, `'full'` on any loss of
 * confidence along the way, `'empty-database'` when there is confidently
 * nothing in `public` at all.
 *
 * `sqlOverride`/`pathsOverride` exist solely for unit testing this decision
 * tree without a live Postgres connection or the real journal/migrations
 * directory — `main()` calls this with no arguments, which reproduces the
 * exact original behavior: open a real connection from `DATABASE_URL`, read
 * the real `db/migrations` journal, and close the connection on the way out.
 * When `sqlOverride` is supplied, this function never opens or closes a
 * connection of its own — the caller owns that lifecycle.
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
        // No migrations have ever applied to this database — a fully known
        // state, not a fallback trigger. Everything in the journal is pending.
        appliedMax = null;
      } else {
        // Connection refused, permission denied, etc. — confidence lost.
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
      // db:migrate is about to run, so an empty pending list right before it
      // runs is suspicious rather than reassuring — fall back rather than
      // trust a table list built from nothing.
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

    // A table a pending CREATE TABLE is about to create does not exist yet —
    // pg_dump --table errors on a table that does not exist, and there is no
    // pre-existing data in it to lose anyway. Scope the backup to whatever
    // the migrations touch that already exists.
    const existing = [...extracted].filter((t) => realTables.has(t));

    if (existing.length === 0) {
      if (realTables.size === 0) {
        // Verified by the query above: zero tables anywhere in `public`.
        // Nothing pre-existing for any backup, of any scope, to protect.
        return 'empty-database';
      }
      // Tables exist, but nothing the pending migrations touch already does
      // (e.g. a migration that only adds new, unrelated tables) — same
      // "guessing wrong is worse than a bigger dump" principle as the other
      // fallbacks above.
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
    // Verified, not assumed: determineScope() only returns this after a
    // direct pg_tables query came back with zero rows. Nothing to back up.
    console.log('  scope: none — public schema has no tables yet, nothing to back up.');
  } else {
    console.log(scope === 'full' ? '  scope: full schema' : `  scope: ${scope.join(', ')}`);
    // Hard stop: requireFreshBackup throws unless a complete, scope-appropriate
    // dump lands on disk. Nothing below this line runs if it does.
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

// Only run as a side effect of executing this file directly (`npm run
// db:migrate`, i.e. `tsx db/migrate.ts`) — not when it's imported, e.g. by
// db/__tests__/migrate.test.ts to unit-test determineScope(). Mirrors the
// reason migrate-tables.ts was split out in the first place (see its
// docstring): importing this module must not have side effects.
const isMainModule = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((err) => {
    console.error('Migrate guard failed:', err);
    process.exit(1);
  });
}
