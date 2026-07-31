import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  assertUsableDump,
  backupPath,
  requireUsableDumpOrDiscard,
  resolvePgDump,
  splitConnectionSecret,
  MIN_BACKUP_BYTES,
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
