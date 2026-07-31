/**
 * Pre-seed backup guard.
 *
 * `db/seed-gold.ts` deletes nine tables before it re-imports them. Twice now
 * that has gone wrong against the live database, and both times there was no
 * dump to go back to. So: take one first, prove it is real, and refuse to let
 * the seed run at all if either step fails.
 *
 * The seed calls `requireFreshBackup()` as its very first action, before it
 * reads a CSV or deletes a row — see the call site in seed-gold.ts. Putting the
 * guard inside the seed rather than in front of it as a separate npm script is
 * deliberate: `npm run db:seed:gold` is not the only way people start this
 * thing, and a guard you can skip by invoking tsx directly is not a guard.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';

/** Gitignored; see .gitignore. Relative to the repo root. */
export const BACKUP_DIR = 'db/backups';

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
 * Content that must be present for the dump to be worth keeping. The schema
 * line proves pg_dump got as far as emitting DDL; the COPY line proves it
 * reached the data section of the one table whose loss started this (wiping
 * members cascade-deletes leadership rows); the trailing marker is pg_dump's
 * own "I finished" line and is the only reliable check against truncation.
 */
export const REQUIRED_MARKERS = [
  'CREATE TABLE public.members',
  'COPY public.members',
  '-- PostgreSQL database dump complete',
];

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
 */
export function assertUsableDump(file: string): void {
  if (!existsSync(file)) {
    throw new Error(`pg_dump reported success but wrote no file at ${file}.`);
  }
  const bytes = statSync(file).size;
  if (bytes < MIN_BACKUP_BYTES) {
    throw new Error(
      `Backup at ${file} is ${bytes} bytes, below the ${MIN_BACKUP_BYTES}-byte minimum. ` +
        'A failed pg_dump still writes a header, so a small file means the dump did not ' +
        'complete — refusing to seed on top of it.'
    );
  }
  const text = readFileSync(file, 'utf8');
  const missing = REQUIRED_MARKERS.filter((m) => !text.includes(m));
  if (missing.length > 0) {
    throw new Error(
      `Backup at ${file} (${bytes} bytes) is missing expected content: ` +
        `${missing.map((m) => JSON.stringify(m)).join(', ')}. ` +
        'The dump is incomplete or is not a dump of this schema — refusing to seed.'
    );
  }
}

/**
 * Dumps the database `DATABASE_URL` points at and returns the file path.
 * Throws — which aborts the seed — if anything about the dump is not right.
 *
 * The connection string is passed as an argv element to a non-shell spawn, so
 * it is never word-split, never interpolated, and never logged: it carries the
 * database password.
 */
export function requireFreshBackup(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — cannot back up before seeding.');
  }

  mkdirSync(resolve(process.cwd(), BACKUP_DIR), { recursive: true });
  const file = backupPath();
  const pgDump = resolvePgDump();

  console.log(`Backing up with ${pgDump} -> ${file}`);
  const result = spawnSync(
    pgDump,
    ['--no-owner', '--no-acl', '--schema=public', '--file', file, url],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw new Error(
      `Could not run pg_dump at "${pgDump}": ${result.error.message}. ` +
        'Set PG_DUMP to the pg_dump binary for your Postgres version.'
    );
  }
  if (result.status !== 0) {
    // Drop the stub so a later run cannot mistake it for a good backup.
    if (existsSync(file)) unlinkSync(file);
    throw new Error(
      `pg_dump exited ${result.status}. Refusing to seed without a backup.\n` +
        `${(result.stderr ?? '').trim()}`
    );
  }

  assertUsableDump(file);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`  backup OK (${kb} KB). Proceeding.`);
  return file;
}
