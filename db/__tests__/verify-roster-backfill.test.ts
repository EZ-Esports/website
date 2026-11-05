import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from './helpers/pglite-migrations';
import { formatReport, isHealthy, loadReport, parseArgs, type RowQuery } from '../verify-roster-backfill';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let client: PGlite;
const query: RowQuery = async (text) => (await client.query(text)).rows as Record<string, unknown>[];
const one = async <T = { id: string }>(text: string, params: unknown[] = []) => (await client.query(text, params)).rows[0] as T;

beforeAll(async () => {
  client = new PGlite();
  await applyMigrations(client);
});
afterAll(async () => {
  await client.close();
});

describe('verify-roster-backfill', () => {
  it('is read-only by construction: no write statements and the seed-target gate is called', () => {
    const src = readFileSync(resolve(__dirname, '../verify-roster-backfill.ts'), 'utf8');
    expect(src).toMatch(/assertSeedTargetAllowed\(url\)/);
    expect(src).not.toMatch(/\b(insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+|alter\s+table|truncate)\b/i);
  });

  it('accepts only --dry-run', () => {
    expect(parseArgs([])).toEqual({ dryRun: true });
    expect(parseArgs(['--dry-run'])).toEqual({ dryRun: true });
    expect(() => parseArgs(['--execute'])).toThrow(/read-only/);
  });

  it('reports a healthy, scoped database and counts what step 5 would still add', async () => {
    const game = (await one(`insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`)).id;
    const season = (await one(`insert into seasons (game_id, name) values ($1, '2026-27') returning id`, [game])).id;
    const school = (await one(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`)).id;
    const team = (await one(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [school, game, season])).id;
    await client.query(`insert into rosters (team_id, name, division) values ($1, 'Varsity', 'A')`, [team]);

    const report = await loadReport(query);
    expect(report.migrationApplied).toBe(true);
    expect(report.scopes).toEqual([{ game: 'valorant', season: '2026-27', rosters: 1, unscoped: 0, mismatched: 0, noTeam: 0, noMembership: 0 }]);
    expect(isHealthy(report)).toBe(true);
    expect(formatReport(report)).toContain('OK: every roster is scoped');
  });

  it('flags an unscoped roster and a roster that disagrees with its team, with counts only', async () => {
    const game = (await one<{ id: string }>(`select id from games where slug = 'valorant'`)).id;
    const season = (await one<{ id: string }>(`select id from seasons where name = '2026-27'`)).id;
    const other = (await one(`insert into schools (name, slug) values ('Beta HS', 'beta') returning id`)).id;
    const team = (await one<{ id: string }>(`select id from teams limit 1`)).id;
    await client.exec(`alter table rosters disable trigger rosters_fill_scope_trg`);
    await client.query(`insert into rosters (team_id, name, division) values ($1, 'Legacy', 'A')`, [team]); // unscoped
    await client.query(`insert into rosters (team_id, school_id, game_id, season_id, name, division) values ($1, $2, $3, $4, 'Wrong', 'A')`, [team, other, game, season]); // mismatched
    await client.exec(`alter table rosters enable trigger rosters_fill_scope_trg`);

    const report = await loadReport(query);
    expect(isHealthy(report)).toBe(false);
    const row = report.scopes.find((s) => s.game === 'valorant' && s.season === '2026-27')!;
    expect(row.unscoped).toBeGreaterThanOrEqual(1);
    expect(row.mismatched).toBeGreaterThanOrEqual(1);
    const text = formatReport(report);
    expect(text).toContain('PROBLEM');
    expect(text).not.toMatch(/alpha|beta|@/i); // no school names, no emails
  });
});
