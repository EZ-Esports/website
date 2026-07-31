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
 * Same checks as `assertUsableDump`, but a dump that fails them is deleted
 * before the error propagates.
 *
 * A rejected dump is by definition not a backup — a header pg_dump wrote before
 * it died, or a file that is not a dump of this schema. Leaving it in
 * db/backups/ next to the real ones lets partial dumps accumulate, and the next
 * person reaching for "the most recent backup" reaches for a broken one. The
 * non-zero-exit path already cleans up; this closes the other half.
 */
export function requireUsableDumpOrDiscard(file: string): void {
  try {
    assertUsableDump(file);
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
 * Dumps the database `DATABASE_URL` points at and returns the file path.
 * Throws — which aborts the seed — if anything about the dump is not right.
 *
 * The connection string never reaches a shell (spawn without `shell: true`, so
 * it is never word-split or interpolated) and is never logged. Its password is
 * stripped out of the argv pg_dump is given and handed over in the child's
 * environment as `PGPASSWORD` instead, so it is not on display in `ps` for the
 * length of the dump. The backup path is built from a timestamp alone and never
 * embeds a credential.
 */
export function requireFreshBackup(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — cannot back up before seeding.');
  }

  mkdirSync(resolve(process.cwd(), BACKUP_DIR), { recursive: true });
  const file = backupPath();
  const pgDump = resolvePgDump();
  const { safeUrl, password } = splitConnectionSecret(url);

  console.log(`Backing up with ${pgDump} -> ${file}`);
  const result = spawnSync(
    pgDump,
    ['--no-owner', '--no-acl', '--schema=public', '--file', file, safeUrl],
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
    if (existsSync(file)) unlinkSync(file);
    throw new Error(
      `pg_dump exited ${result.status}. Refusing to seed without a backup.\n` +
        `${(result.stderr ?? '').trim()}`
    );
  }

  requireUsableDumpOrDiscard(file);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`  backup OK (${kb} KB). Proceeding.`);
  return file;
}
