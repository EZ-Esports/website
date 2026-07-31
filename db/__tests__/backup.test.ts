import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  assertUsableDump,
  backupPath,
  resolvePgDump,
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
