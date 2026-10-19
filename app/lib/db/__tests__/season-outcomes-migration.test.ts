import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');
const TAG = '0051_season_outcomes_finalized';

describe('seasons.outcomes_finalized_at migration (0051)', () => {
  const sql = readFileSync(resolve(migrationsDir, `${TAG}.sql`), 'utf8');

  it('adds one nullable timestamp column with no default', () => {
    expect(sql).toContain('ALTER TABLE "seasons" ADD COLUMN IF NOT EXISTS "outcomes_finalized_at" timestamp');
    expect(sql).not.toMatch(/DEFAULT|NOT NULL/i);
    expect(sql).not.toMatch(/DROP|DELETE|INSERT/i);
  });

  it('backfills only archived (inactive) seasons, leaving active ones hidden', () => {
    const updates = sql.match(/UPDATE[^;]*;/gi) ?? [];
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/WHERE "is_active" = false/);
    expect(updates[0]).toMatch(/"outcomes_finalized_at" IS NULL/);
  });

  it('is registered after every earlier journal entry with a real file', () => {
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
