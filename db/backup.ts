/**
 * Pre-seed backup guard.
 *
 * `db/seed-gold.ts` deletes nine tables before it re-imports them. Twice now
 * that has gone wrong against the live database, and both times there was no
 * dump to go back to. So: take one first, prove it is real, and refuse to let
 * the seed run at all if either step fails.
 *
 * Both destructive seeds call `requireFreshBackup()` as their very first
 * action, before they read a CSV or delete a row — see the call sites in
 * seed-gold.ts and seed.ts. db/seed.ts is if anything the more dangerous of the
 * two (it wipes leadership, schools and games as well) and its npm script is
 * one word away from the other's, so guarding only seed-gold would leave the
 * bigger hole open. Putting the guard inside each seed rather than in front of
 * it as a separate npm script is deliberate: `npm run db:seed` is not the only
 * way people start these things, and a guard you can skip by invoking tsx
 * directly is not a guard.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';

/** Gitignored; see .gitignore. Relative to the repo root. */
export const BACKUP_DIR = 'db/backups';

/** How many local backups `requireFreshBackup()` and `db:backup:clean` keep. */
export const DEFAULT_BACKUP_RETENTION = 20;

/**
 * A dump that failed partway still leaves a file on disk: pg_dump writes its
 * header and SET statements before it emits a single table, so `size > 0`
 * proves nothing.
 *
 * Measured against this schema: the header before the first CREATE TABLE is
 * ~4.8 KB, a schema-only dump is ~61 KB, a dump of a migrated-but-empty
 * database is ~70 KB, and a full dump with the archive loaded is ~815 KB.
 * 16 KiB sits in the gap — ~3x above a header, ~4x below the smallest dump
 * that is actually complete — so it cannot trip on a legitimately small
 * database and cannot pass a dump that died during the header.
 */
export const MIN_BACKUP_BYTES = 16 * 1024;

/**
 * Same idea as `MIN_BACKUP_BYTES`, but for a `--table`-scoped dump (see
 * `dumpTables()`), which is legitimately much smaller than a full-schema one —
 * most migrations and both seeds only ever touch a handful of tables, not all
 * of them.
 *
 * Measured directly against this schema (Postgres 16, all migrations applied,
 * empty tables): a scoped dump's preamble — the header/SET-statement block
 * before the first `CREATE TABLE` line — is ~676-681 bytes regardless of how
 * many tables are in scope. The smallest real single-table dump measured
 * (`--table=public.games`, 0 rows) was 2,769 bytes; a 9-table scoped dump
 * (matching db:seed:gold's table list) was 29,227 bytes. 1024 bytes sits in
 * the gap — comfortably above the ~680-byte header-only stub a dump that died
 * immediately would leave behind, comfortably below the smallest complete
 * scoped dump actually observed — so it cannot trip on a legitimately small
 * scoped dump and cannot pass one that died during the header.
 */
export const MIN_SCOPED_BACKUP_BYTES = 1024;

/**
 * Content that must be present for a full (`'full'` scope) dump to be worth
 * keeping. The schema line proves pg_dump got as far as emitting DDL; the COPY
 * line proves it reached the data section of the one table whose loss started
 * this (wiping members cascade-deletes leadership rows); the trailing marker
 * is pg_dump's own "I finished" line and is the only reliable check against
 * truncation.
 */
export const REQUIRED_MARKERS = [
  'CREATE TABLE public.members',
  'COPY public.members',
  '-- PostgreSQL database dump complete',
];

/** pg_dump's own "I finished" line — the one marker every scope requires. */
const COMPLETION_MARKER = '-- PostgreSQL database dump complete';

/**
 * The markers a dump scoped to exactly `tables` must contain: its own
 * `CREATE TABLE`/`COPY` pair for every table in scope, plus the same trailing
 * completion marker every scope requires. Mirrors `REQUIRED_MARKERS`, which
 * stays as the fixed (members-only) marker set for the `'full'` scope.
 */
function markersFor(tables: readonly string[]): string[] {
  return [
    ...tables.flatMap((t) => [`CREATE TABLE public.${t}`, `COPY public.${t}`]),
    COMPLETION_MARKER,
  ];
}

/**
 * Where pg_dump lives. `PG_DUMP` wins; otherwise the first candidate that
 * exists; otherwise bare `pg_dump` off PATH. The Homebrew paths are a
 * convenience for the machines this is usually run from, not a requirement —
 * on anything else (CI, Linux, a different Postgres version) set PG_DUMP.
 */
export function resolvePgDump(): string {
  const override = process.env.PG_DUMP?.trim();
  if (override) return override;

  const candidates = [
    '/opt/homebrew/opt/postgresql@18/bin/pg_dump', // Homebrew, Apple Silicon
    '/usr/local/opt/postgresql@18/bin/pg_dump', // Homebrew, Intel
    '/usr/lib/postgresql/18/bin/pg_dump', // Debian/Ubuntu
  ];
  return candidates.find((p) => existsSync(p)) ?? 'pg_dump';
}

/** `db/backups/gold-seed-2026-07-30T21-40-08-123Z.sql` */
export function backupPath(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return resolve(process.cwd(), BACKUP_DIR, `gold-seed-${stamp}.sql`);
}

/**
 * Checks a dump on disk is a complete dump and not a stub. Exported so the
 * threshold and the markers are testable without shelling out to pg_dump.
 *
 * `tables` is the same scope the dump was taken with: `'full'` (the default,
 * so every pre-existing call site keeps compiling and passing unchanged)
 * checks against the fixed `MIN_BACKUP_BYTES`/`REQUIRED_MARKERS` pair; a table
 * list checks against `MIN_SCOPED_BACKUP_BYTES` and markers built for exactly
 * those tables via `markersFor()`.
 */
export function assertUsableDump(file: string, tables: readonly string[] | 'full' = 'full'): void {
  if (!existsSync(file)) {
    throw new Error(`pg_dump reported success but wrote no file at ${file}.`);
  }
  const bytes = statSync(file).size;
  const minBytes = tables === 'full' ? MIN_BACKUP_BYTES : MIN_SCOPED_BACKUP_BYTES;
  if (bytes < minBytes) {
    throw new Error(
      `Backup at ${file} is ${bytes} bytes, below the ${minBytes}-byte minimum. ` +
        'A failed pg_dump still writes a header, so a small file means the dump did not ' +
        'complete — refusing to seed on top of it.'
    );
  }
  const markers = tables === 'full' ? REQUIRED_MARKERS : markersFor(tables);
  const text = readFileSync(file, 'utf8');
  const missing = markers.filter((m) => !text.includes(m));
  if (missing.length > 0) {
    throw new Error(
      `Backup at ${file} (${bytes} bytes) is missing expected content: ` +
        `${missing.map((m) => JSON.stringify(m)).join(', ')}. ` +
        'The dump is incomplete or is not a dump of this schema — refusing to seed.'
    );
  }
}

/**
 * Same checks as `assertUsableDump`, but a dump that fails them is deleted
 * before the error propagates.
 *
 * A rejected dump is by definition not a backup — a header pg_dump wrote before
 * it died, or a file that is not a dump of this schema. Leaving it in
 * db/backups/ next to the real ones lets partial dumps accumulate, and the next
 * person reaching for "the most recent backup" reaches for a broken one. The
 * non-zero-exit path already cleans up; this closes the other half.
 */
export function requireUsableDumpOrDiscard(file: string, tables: readonly string[] | 'full' = 'full'): void {
  try {
    assertUsableDump(file, tables);
  } catch (err) {
    if (existsSync(file)) unlinkSync(file);
    throw err;
  }
}

/**
 * Splits a libpq connection URI into its password and a URI without it.
 *
 * The password must not travel as an argv element: argv is readable by any
 * process on the machine via `ps` for as long as pg_dump runs, and dumping this
 * database is not instant. Postgres reads `PGPASSWORD` from the environment
 * instead, which is visible only to the process itself and to root.
 *
 * Anything that does not parse as a URI (a libpq keyword/value DSN, a bare
 * database name) is handed back untouched: those forms are already either
 * passwordless or the caller's own doing, and rewriting a string we did not
 * parse is how a connection quietly starts pointing somewhere else.
 */
export function splitConnectionSecret(url: string): { safeUrl: string; password?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safeUrl: url };
  }
  if (!parsed.password) return { safeUrl: url };

  // `URL` hands back the percent-encoded form; PGPASSWORD wants the literal.
  const password = decodeURIComponent(parsed.password);
  parsed.password = '';
  return { safeUrl: parsed.toString(), password };
}

/**
 * Runs pg_dump with the given scope flags (`--schema=public` for a full dump,
 * or one `--table public.<name>` per table for a scoped one) against
 * `DATABASE_URL` and writes to `outputFile`. Shared by `dumpSchema()` and
 * `dumpTables()` — a pure extraction of what used to be inline in
 * `requireFreshBackup()`, not a behavior change: the url-read, `mkdirSync`,
 * `spawnSync`, non-zero-exit/error handling, and stub-cleanup logic are all
 * unchanged from before.
 *
 * The connection string never reaches a shell (spawn without `shell: true`, so
 * it is never word-split or interpolated) and is never logged. Its password is
 * stripped out of the argv pg_dump is given and handed over in the child's
 * environment as `PGPASSWORD` instead, so it is not on display in `ps` for the
 * length of the dump.
 */
function runPgDump(scopeFlags: string[], outputFile: string): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — cannot back up before seeding.');
  }

  mkdirSync(resolve(process.cwd(), BACKUP_DIR), { recursive: true });
  const pgDump = resolvePgDump();
  const { safeUrl, password } = splitConnectionSecret(url);

  console.log(`Backing up with ${pgDump} -> ${outputFile}`);
  const result = spawnSync(
    pgDump,
    ['--no-owner', '--no-acl', ...scopeFlags, '--file', outputFile, safeUrl],
    {
      encoding: 'utf8',
      env: password === undefined ? process.env : { ...process.env, PGPASSWORD: password },
    }
  );

  if (result.error) {
    throw new Error(
      `Could not run pg_dump at "${pgDump}": ${result.error.message}. ` +
        'Set PG_DUMP to the pg_dump binary for your Postgres version.'
    );
  }
  if (result.status !== 0) {
    // Drop the stub so a later run cannot mistake it for a good backup.
    if (existsSync(outputFile)) unlinkSync(outputFile);
    throw new Error(
      `pg_dump exited ${result.status}. Refusing to proceed without a backup.\n` +
        `${(result.stderr ?? '').trim()}`
    );
  }
}

/** Full `--schema=public` dump — the original, unscoped `requireFreshBackup()` behavior. */
export function dumpSchema(outputFile: string): void {
  runPgDump(['--schema=public'], outputFile);
}

/**
 * Builds the `--table public.<name>` flags for a scoped dump, one pair per
 * table, in the order given. A pure function so `dumpTables()`'s argv
 * construction is unit-testable without shelling out to a real pg_dump.
 */
export function tableScopeFlags(tables: string[]): string[] {
  return tables.flatMap((t) => ['--table', `public.${t}`]);
}

/**
 * Same pg_dump invocation as `dumpSchema()`, but scoped to specific tables via
 * one `--table public.<name>` flag per table instead of `--schema=public`.
 * Reuses `resolvePgDump()` and `splitConnectionSecret()` (via `runPgDump()`)
 * as-is.
 */
export function dumpTables(tables: string[], outputFile: string): void {
  runPgDump(tableScopeFlags(tables), outputFile);
}

/**
 * Dumps the database `DATABASE_URL` points at, scoped to `tables` (or the
 * whole `public` schema when `tables` is `'full'`), and returns the file path.
 * Throws — which aborts the seed/migration — if anything about the dump is
 * not right. Prunes old local backups (`pruneLocalBackups()`) as its last
 * step, once the new file is already written and safely part of what gets
 * sorted — so pruning can never delete the backup it was just asked to take.
 */
export function requireFreshBackup(tables: readonly string[] | 'full'): string {
  const file = backupPath();

  if (tables === 'full') {
    dumpSchema(file);
  } else {
    dumpTables([...tables], file);
  }

  requireUsableDumpOrDiscard(file, tables);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`  backup OK (${kb} KB). Proceeding.`);

  pruneLocalBackups();
  return file;
}

/**
 * Deletes everything in `BACKUP_DIR` beyond the newest `keep` files.
 *
 * Sorting by filename (not mtime) is deliberate and sufficient: every name
 * `backupPath()` produces embeds an ISO timestamp with `:`/`.` swapped for
 * `-`, which sorts lexicographically in the same order as the timestamps
 * themselves. `dir` is overridable so this is testable against a scratch
 * directory instead of the real `db/backups/`.
 */
export function pruneLocalBackups(keep = DEFAULT_BACKUP_RETENTION, dir: string = resolve(process.cwd(), BACKUP_DIR)): string[] {
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const name of toDelete) {
    unlinkSync(resolve(dir, name));
  }
  return toDelete;
}
