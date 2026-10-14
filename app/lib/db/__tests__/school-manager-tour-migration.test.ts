import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');

describe('school_managers.tour_completed_at migration (0048)', () => {
  const sql = readFileSync(
    resolve(migrationsDir, '0048_school_manager_tour_completed.sql'),
    'utf8',
  );

  it('adds one nullable column with no default and no backfill', () => {
    expect(sql).toContain('ALTER TABLE "school_managers" ADD COLUMN IF NOT EXISTS "tour_completed_at" timestamp');
    expect(sql).not.toMatch(/DEFAULT|NOT NULL/i);
    // Existing managers must see the tour once, so no existing row may be stamped.
    expect(sql).not.toMatch(/UPDATE|INSERT/i);
  });

  it('is registered in the journal after every earlier entry', () => {
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDir, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string; when: number }[] };
    const entry = journal.entries.find((e) => e.tag === '0048_school_manager_tour_completed');
    expect(entry).toBeDefined();
    expect(entry!.idx).toBe(48);
    for (const other of journal.entries.filter((e) => e !== entry)) {
      expect(entry!.when).toBeGreaterThan(other.when);
    }
  });
});
