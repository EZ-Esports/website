import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationsDir = resolve(__dirname, '../../../../db/migrations');

describe('manager_invites migration (0049)', () => {
  const sql = readFileSync(resolve(migrationsDir, '0049_manager_invites_table.sql'), 'utf8');

  it('creates the table with RLS enabled and no policies', () => {
    expect(sql).toContain('CREATE TABLE "manager_invites"');
    expect(sql).toContain('ALTER TABLE "manager_invites" ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it('copies manager rows before deleting them, preserving id and token_hash', () => {
    const insertAt = sql.indexOf('INSERT INTO "manager_invites"');
    const deleteAt = sql.indexOf('DELETE FROM "player_invites"');
    expect(insertAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(insertAt);
    expect(sql.slice(insertAt, deleteAt)).toMatch(/"id",[\s\S]*"token_hash"/);
    expect(sql).toContain('RAISE EXCEPTION');
  });

  it('drops role, its index, and restores game_id NOT NULL only after a null check', () => {
    const dropRole = sql.indexOf('DROP COLUMN "role"');
    const guard = sql.indexOf('Cannot restore player_invites.game_id NOT NULL');
    const setNotNull = sql.indexOf('ALTER COLUMN "game_id" SET NOT NULL');
    expect(sql).toContain('DROP INDEX IF EXISTS "player_invites_school_role_idx"');
    expect(dropRole).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(dropRole);
    expect(setNotNull).toBeGreaterThan(guard);
  });

  it('is registered in the journal after every earlier entry', () => {
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDir, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string; when: number }[] };
    const entry = journal.entries.find((e) => e.tag === '0049_manager_invites_table');
    expect(entry?.idx).toBe(49);
    for (const other of journal.entries.filter((e) => e.idx < 49)) {
      expect(entry!.when).toBeGreaterThan(other.when);
    }
  });
});
