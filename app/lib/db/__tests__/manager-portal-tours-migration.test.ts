import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');

describe('manager_portal_tours migration (0048)', () => {
  const sql = readFileSync(resolve(migrationsDir, '0048_manager_portal_tours.sql'), 'utf8');

  it('creates a per-account table with RLS enabled and no backfill', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "manager_portal_tours"');
    expect(sql).toContain('"user_id" uuid PRIMARY KEY NOT NULL');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    // Existing managers must see the tour once, so no rows may be inserted here.
    expect(sql).not.toMatch(/INSERT\s+INTO/i);
  });

  it('is registered in the journal after every earlier entry', () => {
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDir, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string; when: number }[] };
    const entry = journal.entries.find((e) => e.tag === '0048_manager_portal_tours');
    expect(entry).toBeDefined();
    for (const other of journal.entries.filter((e) => e !== entry)) {
      expect(entry!.when).toBeGreaterThan(other.when);
    }
  });
});
