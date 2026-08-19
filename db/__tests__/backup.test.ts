import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  assertUsableDump,
  backupPath,
  pruneLocalBackups,
  requireUsableDumpOrDiscard,
  resolvePgDump,
  splitConnectionSecret,
  tableScopeFlags,
  MIN_BACKUP_BYTES,
  MIN_SCOPED_BACKUP_BYTES,
  REQUIRED_MARKERS,
} from '../backup';

/** A dump that looks real: every required marker, padded past the size floor. */
function goodDump(): string {
  const body = REQUIRED_MARKERS.join('\n');
  return `${body}\n${'-- filler\n'.repeat(MIN_BACKUP_BYTES / 10)}`;
}

describe('assertUsableDump', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, contents: string) => {
    const file = join(dir, name);
    writeFileSync(file, contents);
    return file;
  };

  it('accepts a complete dump', () => {
    expect(() => assertUsableDump(write('ok.sql', goodDump()))).not.toThrow();
  });

  it('rejects a missing file', () => {
    expect(() => assertUsableDump(join(dir, 'nope.sql'))).toThrow(/wrote no file/);
  });

  it('rejects an empty file', () => {
    expect(() => assertUsableDump(write('empty.sql', ''))).toThrow(/below the/);
  });

  // The reason the threshold is a byte count and not `size > 0`: pg_dump writes
  // its header before it reads a single row, so a dump that dies immediately
  // still leaves a plausible-looking file behind.
  it('rejects a header-only stub that a failed pg_dump would leave behind', () => {
    const stub = [
      '--',
      '-- PostgreSQL database dump',
      '--',
      "SET statement_timeout = 0;",
      "SET client_encoding = 'UTF8';",
      'SET search_path = public;',
    ].join('\n');
    expect(stub.length).toBeGreaterThan(0);
    expect(() => assertUsableDump(write('stub.sql', stub))).toThrow(/below the/);
  });

  it('rejects a large file that is not a dump of this schema', () => {
    expect(() => assertUsableDump(write('wrong.sql', '-- filler\n'.repeat(20000)))).toThrow(
      /missing expected content/
    );
  });

  it.each(REQUIRED_MARKERS)('rejects a dump truncated before %s', (marker) => {
    const truncated = goodDump().replace(marker, '');
    expect(() => assertUsableDump(write('cut.sql', truncated))).toThrow(/missing expected content/);
  });

  // The trailing marker is the only check that catches a dump killed midway
  // through the data section, which is otherwise big enough to pass the floor.
  it('rejects a big dump with no completion marker', () => {
    const cut = goodDump().replace('-- PostgreSQL database dump complete', '');
    expect(cut.length).toBeGreaterThan(MIN_BACKUP_BYTES);
    expect(() => assertUsableDump(write('midway.sql', cut))).toThrow(
      /PostgreSQL database dump complete/
    );
  });
});

describe('assertUsableDump with a table scope', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backup-scoped-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, contents: string) => {
    const file = join(dir, name);
    writeFileSync(file, contents);
    return file;
  };

  /** A dump that looks real for exactly `tables`, padded past the scoped floor. */
  function goodScopedDump(tables: string[]): string {
    const body = [
      ...tables.flatMap((t) => [`CREATE TABLE public.${t}`, `COPY public.${t}`]),
      '-- PostgreSQL database dump complete',
    ].join('\n');
    return `${body}\n${'-- filler\n'.repeat(MIN_SCOPED_BACKUP_BYTES / 5)}`;
  }

  it('accepts a complete dump scoped to exactly the given tables', () => {
    expect(() => assertUsableDump(write('ok.sql', goodScopedDump(['games'])), ['games'])).not.toThrow();
  });

  // The bug this whole scope parameter exists to fix: a single-table scoped
  // dump (measured at ~2.7 KB against this schema) is well under the 16 KiB
  // full-schema floor, and would be wrongly rejected without a smaller,
  // scope-appropriate minimum.
  it('does not reject a small-but-complete single-table dump against the full-schema floor', () => {
    const dump = goodScopedDump(['games']);
    expect(dump.length).toBeLessThan(MIN_BACKUP_BYTES);
    expect(() => assertUsableDump(write('small.sql', dump), ['games'])).not.toThrow();
  });

  it('rejects a scoped dump below the scoped minimum', () => {
    expect(() => assertUsableDump(write('stub.sql', 'CREATE TABLE public.games'), ['games'])).toThrow(
      /below the/
    );
  });

  it('rejects a scoped dump missing one of its own tables', () => {
    const dump = goodScopedDump(['games']);
    expect(() => assertUsableDump(write('missing.sql', dump), ['games', 'schools'])).toThrow(
      /missing expected content/
    );
  });

  it('does not require markers for tables outside the given scope', () => {
    // A dump scoped to just `games` should not be judged against `members`,
    // the fixed 'full'-scope marker — scoped and full checks are independent.
    const dump = goodScopedDump(['games']);
    expect(dump).not.toContain('CREATE TABLE public.members');
    expect(() => assertUsableDump(write('ok2.sql', dump), ['games'])).not.toThrow();
  });
});

describe('requireUsableDumpOrDiscard', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backup-discard-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, contents: string) => {
    const file = join(dir, name);
    writeFileSync(file, contents);
    return file;
  };

  it('keeps a dump it accepts', () => {
    const file = write('ok.sql', goodDump());
    expect(() => requireUsableDumpOrDiscard(file)).not.toThrow();
    expect(existsSync(file)).toBe(true);
  });

  // Otherwise every aborted seed leaves a stub behind and db/backups/ fills with
  // files that look like backups and would not restore.
  it('deletes a dump it rejects, so stubs cannot pile up in db/backups', () => {
    const file = write('stub.sql', '-- PostgreSQL database dump\n');
    expect(() => requireUsableDumpOrDiscard(file)).toThrow(/below the/);
    expect(existsSync(file)).toBe(false);
  });

  it('deletes a big file that is not a dump of this schema', () => {
    const file = write('wrong.sql', '-- filler\n'.repeat(20000));
    expect(() => requireUsableDumpOrDiscard(file)).toThrow(/missing expected content/);
    expect(existsSync(file)).toBe(false);
  });

  it('still reports a dump that was never written', () => {
    expect(() => requireUsableDumpOrDiscard(join(dir, 'nope.sql'))).toThrow(/wrote no file/);
  });
});

// The password must not be an argv element: argv is readable via `ps` by any
// user on the box for as long as pg_dump runs.
describe('splitConnectionSecret', () => {
  it('moves the password out of the URL', () => {
    expect(splitConnectionSecret('postgresql://postgres:hunter2@db.example:5432/app')).toEqual({
      safeUrl: 'postgresql://postgres@db.example:5432/app',
      password: 'hunter2',
    });
  });

  it('hands PGPASSWORD the decoded password, since libpq does not unescape it', () => {
    const { password } = splitConnectionSecret('postgresql://u:p%40ss%2Fword%3A1@h:5432/d');
    expect(password).toBe('p@ss/word:1');
  });

  it('keeps the rest of the URL intact — user, host, port, database, params', () => {
    const { safeUrl } = splitConnectionSecret(
      'postgresql://admin:s3cret@db.example:6543/app?sslmode=require&application_name=seed'
    );
    expect(safeUrl).toBe(
      'postgresql://admin@db.example:6543/app?sslmode=require&application_name=seed'
    );
    expect(safeUrl).not.toContain('s3cret');
  });

  it('leaves a passwordless URL exactly as it was', () => {
    const url = 'postgresql://postgres@127.0.0.1:5432/app';
    expect(splitConnectionSecret(url)).toEqual({ safeUrl: url });
  });

  // Rewriting a string we could not parse is how a connection quietly starts
  // pointing at a different database.
  it('passes a non-URI DSN through untouched', () => {
    const dsn = 'host=127.0.0.1 port=5432 dbname=app user=postgres';
    expect(splitConnectionSecret(dsn)).toEqual({ safeUrl: dsn });
  });
});

describe('resolvePgDump', () => {
  const original = process.env.PG_DUMP;
  afterEach(() => {
    if (original === undefined) delete process.env.PG_DUMP;
    else process.env.PG_DUMP = original;
  });

  it('prefers the PG_DUMP override so the path is not Apple-Silicon-only', () => {
    process.env.PG_DUMP = '/somewhere/else/pg_dump';
    expect(resolvePgDump()).toBe('/somewhere/else/pg_dump');
  });

  it('ignores a blank override and falls back to a real candidate', () => {
    process.env.PG_DUMP = '   ';
    expect(resolvePgDump()).toMatch(/pg_dump$/);
  });
});

describe('backupPath', () => {
  it('is timestamped, so a second run cannot overwrite the first backup', () => {
    const a = backupPath(new Date('2026-07-30T21:40:08.123Z'));
    const b = backupPath(new Date('2026-07-30T21:40:09.123Z'));
    expect(a).not.toBe(b);
    expect(a.endsWith('db/backups/gold-seed-2026-07-30T21-40-08-123Z.sql')).toBe(true);
  });
});

// dumpTables() builds its argv from this. Testing it directly, rather than
// shelling out to pg_dump or mocking child_process, keeps this test from
// touching the real filesystem (dumpTables/requireFreshBackup create
// BACKUP_DIR as a side effect) while still covering the thing that matters:
// what pg_dump is actually told to dump.
describe('tableScopeFlags', () => {
  it('builds one --table public.<name> pair per table, in order', () => {
    expect(tableScopeFlags(['games', 'schools', 'members'])).toEqual([
      '--table', 'public.games',
      '--table', 'public.schools',
      '--table', 'public.members',
    ]);
  });

  it('never includes --schema=public', () => {
    expect(tableScopeFlags(['games'])).not.toContain('--schema=public');
  });

  it('is empty for an empty table list', () => {
    expect(tableScopeFlags([])).toEqual([]);
  });
});

describe('pruneLocalBackups', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backup-prune-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Writes a dummy backup file with a real backupPath()-shaped name. */
  function writeBackupAt(date: Date): string {
    // backupPath() resolves against BACKUP_DIR under process.cwd(); reproduce
    // just its filename convention here rather than pointing it at `dir`.
    const stamp = date.toISOString().replace(/[:.]/g, '-');
    const name = `gold-seed-${stamp}.sql`;
    writeFileSync(join(dir, name), 'placeholder');
    return name;
  }

  it('keeps everything when there are fewer files than the retention count', () => {
    const names = [0, 1, 2].map((i) => writeBackupAt(new Date(2026, 0, 1 + i)));
    const deleted = pruneLocalBackups(20, dir);
    expect(deleted).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(names.sort());
  });

  it('deletes all but the newest `keep` files', () => {
    const names = Array.from({ length: 25 }, (_, i) => writeBackupAt(new Date(2026, 0, 1 + i)));
    const deleted = pruneLocalBackups(20, dir);
    expect(deleted).toHaveLength(5);
    // The oldest 5 (by timestamp, i.e. lexicographic filename order) are gone.
    expect(deleted).toEqual(names.slice(0, 5));
    const remaining = readdirSync(dir).sort();
    expect(remaining).toEqual(names.slice(5).sort());
    expect(remaining).toHaveLength(20);
  });

  // The off-by-one risk the spec calls out explicitly: a file written "just
  // now", as the 21st file when the retention count is 20, must survive —
  // pruning must never delete the backup that was just taken.
  it('never deletes a file written just now, even as the (keep + 1)th file', () => {
    // 20 older files + 1 written now = 21 total, keep = 20: exactly one file
    // (the oldest) should go, and it must not be the one just written.
    const older = Array.from({ length: 20 }, (_, i) => writeBackupAt(new Date(2020, 0, 1 + i)));
    const justNow = writeBackupAt(new Date());
    const deleted = pruneLocalBackups(20, dir);
    expect(deleted).toEqual([older[0]]);
    expect(deleted).not.toContain(justNow);
    const remaining = readdirSync(dir).sort();
    expect(remaining).toEqual([...older.slice(1), justNow].sort());
    expect(remaining).toContain(justNow);
  });

  it('does nothing (and does not throw) when the directory does not exist', () => {
    const missing = join(dir, 'does-not-exist');
    expect(() => pruneLocalBackups(20, missing)).not.toThrow();
    expect(pruneLocalBackups(20, missing)).toEqual([]);
  });

  it('ignores non-.sql files in the directory', () => {
    writeFileSync(join(dir, '.gitkeep'), '');
    const names = Array.from({ length: 3 }, (_, i) => writeBackupAt(new Date(2026, 0, 1 + i)));
    pruneLocalBackups(1, dir);
    expect(readdirSync(dir).sort()).toEqual(['.gitkeep', names[2]].sort());
  });
});
