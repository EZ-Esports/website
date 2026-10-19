import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');
const TAG = '0050_season_rosters_locked';

describe('seasons.rosters_locked_at migration (0050)', () => {
  const sql = readFileSync(resolve(migrationsDir, `${TAG}.sql`), 'utf8');

  it('adds one nullable timestamp column with no default and no backfill', () => {
    expect(sql).toContain('ALTER TABLE "seasons" ADD COLUMN IF NOT EXISTS "rosters_locked_at" timestamp');
    expect(sql).not.toMatch(/DEFAULT|NOT NULL/i);
    // Every existing season must start unlocked, so no row may be stamped.
    expect(sql).not.toMatch(/UPDATE|INSERT|DELETE|DROP/i);
  });

  it('is registered in the journal after every earlier entry, with a unique idx and a real file', () => {
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDir, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string; when: number }[] };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry).toBeDefined();
    expect(existsSync(resolve(migrationsDir, `${entry!.tag}.sql`))).toBe(true);
    for (const other of journal.entries.filter((e) => e.idx < entry!.idx)) {
      expect(entry!.when).toBeGreaterThan(other.when);
    }
    expect(new Set(journal.entries.map((e) => e.idx)).size).toBe(journal.entries.length);
  });
});
