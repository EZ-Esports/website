/**
 * Migration 0060 (spec-060, EXPAND) against an in-memory PGlite built from db/migrations/*.sql. Nothing
 * else is touched. Covers the backfill, idempotent re-runs, the BEFORE INSERT trigger and the
 * critical property that removing a team row can never delete rosters.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const MIGRATION = readFileSync(resolve(__dirname, '../../../../db/migrations/0060_rosters_scope_expand.sql'), 'utf8');

let client: PGlite;
let gameId: string;
let seasonId: string;
let schoolA: string;
let schoolB: string;
let n = 0;

async function one<T = { id: string }>(text: string, params: unknown[] = []) {
  return (await client.query(text, params)).rows[0] as T;
}
async function count(text: string, params: unknown[] = []) {
  return Number((await one<{ c: string }>(`select count(*)::int as c from (${text}) q`, params)).c);
}
/** Re-runs the migration exactly as the migrator would: statement by statement. */
async function rerunMigration() {
  for (const raw of MIGRATION.split('--> statement-breakpoint')) {
    const statement = raw.trim();
    if (statement) await client.exec(statement);
  }
}
const school = async (name: string) => (await one(`insert into schools (name, slug) values ($1, $1) returning id`, [name])).id;
const team = async (schoolId: string, season = seasonId) =>
  (await one(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [schoolId, gameId, season])).id;

beforeAll(async () => {
  client = new PGlite();
  const report = await applyMigrations(client, { through: '0060_rosters_scope_expand' });
  expect(report.skipped.filter((s) => s.file === '0060_rosters_scope_expand')).toEqual([]);
  gameId = (await one(`insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`)).id;
  seasonId = (await one(`insert into seasons (game_id, name) values ($1, '2026-27') returning id`, [gameId])).id;
  schoolA = await school('Alpha HS');
  schoolB = await school('Beta HS');
});

afterAll(async () => {
  await client.close();
});

describe('0060 expand: schema', () => {
  it('adds the three nullable, indexed scope columns', async () => {
    const cols = (
      await client.query(`select column_name, is_nullable from information_schema.columns where table_name = 'rosters' and column_name in ('school_id','game_id','season_id','team_id') order by 1`)
    ).rows as Array<{ column_name: string; is_nullable: string }>;
    expect(Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]))).toEqual({
      game_id: 'YES', school_id: 'YES', season_id: 'YES', team_id: 'YES',
    });
    const idx = (await client.query(`select indexname from pg_indexes where tablename = 'rosters'`)).rows.map((r: any) => r.indexname);
    expect(idx).toEqual(expect.arrayContaining(['rosters_school_game_season_idx', 'rosters_season_id_idx', 'rosters_team_name_unique_idx']));
  });

  it('drops the foreign key from rosters to teams', async () => {
    expect(
      await count(`select 1 from pg_constraint where conrelid = 'public.rosters'::regclass and contype = 'f' and confrelid = 'public.teams'::regclass`),
    ).toBe(0);
  });
});

describe('removing a team row never deletes rosters or players (the critical property)', () => {
  it('keeps the roster and its player when the team is deleted', async () => {
    const a = await team(schoolA);
    const roster = (await one(`insert into rosters (team_id, name, division) values ($1, 'Varsity', 'A') returning id`, [a])).id;
    const member = (await one(`insert into members (first_name, last_name, school_id) values ('A', 'B', $1) returning id`, [schoolA])).id;
    await client.query(`insert into players (roster_id, member_id) values ($1, $2)`, [roster, member]);

    await client.query(`delete from teams where id = $1`, [a]);

    expect(await count(`select 1 from rosters where id = '${roster}'`)).toBe(1);
    expect(await count(`select 1 from players where roster_id = '${roster}'`)).toBe(1);
    // ...and the scope columns the trigger filled are still there to say who it belongs to.
    expect(await one<{ school_id: string }>(`select school_id from rosters where id = $1`, [roster])).toEqual({ school_id: schoolA });
  });

  it('still deletes the rosters of a season that is deleted (cascade from season_id, as before)', async () => {
    const season = (await one(`insert into seasons (game_id, name) values ($1, '2020-21') returning id`, [gameId])).id;
    const t = await team(schoolB, season);
    await client.query(`insert into rosters (team_id, name, division) values ($1, 'Varsity', 'A')`, [t]);
    await client.query(`delete from seasons where id = $1`, [season]);
    expect(await count(`select 1 from rosters where season_id = '${season}'`)).toBe(0);
  });
});

describe('BEFORE INSERT trigger', () => {
  it('fills the scope from team_id for an old-style insert', async () => {
    n += 1;
    const t = await team(schoolB);
    const r = await one<{ school_id: string; game_id: string; season_id: string }>(
      `insert into rosters (team_id, name, division) values ($1, $2, 'A') returning school_id, game_id, season_id`,
      [t, `Old ${n}`],
    );
    expect(r).toEqual({ school_id: schoolB, game_id: gameId, season_id: seasonId });
  });

  it('leaves explicitly supplied values alone', async () => {
    const t = await team(await school('Gamma HS'));
    const r = await one<{ school_id: string }>(
      `insert into rosters (team_id, school_id, game_id, season_id, name, division) values ($1, $2, $3, $4, 'Explicit', 'A') returning school_id`,
      [t, schoolA, gameId, seasonId],
    );
    expect(r.school_id).toBe(schoolA);
  });
});

describe('backfill and idempotent re-run', () => {
  it('fills a legacy roster from its team, and a second run changes nothing', async () => {
    const t = await team(await school('Delta HS'));
    await client.exec(`alter table rosters disable trigger rosters_fill_scope_trg`);
    const legacy = (await one(`insert into rosters (team_id, name, division) values ($1, 'Legacy', 'A') returning id`, [t])).id;
    await client.exec(`alter table rosters enable trigger rosters_fill_scope_trg`);
    expect((await one<{ school_id: string | null }>(`select school_id from rosters where id = $1`, [legacy])).school_id).toBeNull();

    await rerunMigration();
    const filled = await one<{ school_id: string; season_id: string }>(`select school_id, season_id from rosters where id = $1`, [legacy]);
    expect(filled.season_id).toBe(seasonId);
    expect(filled.school_id).not.toBeNull();

    const before = [await count(`select 1 from rosters`), await count(`select 1 from teams`)];
    await rerunMigration();
    expect([await count(`select 1 from rosters`), await count(`select 1 from teams`)]).toEqual(before);
    expect(await count(`select 1 from rosters where school_id is null`)).toBe(0);
  });

  it('creates membership rows for archived standings, once, and none for tournament appearances', async () => {
    const archived = await school('Archive HS');
    const bracket = await school('Bracket HS');
    await client.query(`insert into season_standings (season_id, school_id, division, rank) values ($1, $2, 'Varsity', 1)`, [seasonId, archived]);
    const tournament = (await one(`insert into tournaments (game_id, season_id, name, slug) values ($1, $2, 'Cup', 'cup') returning id`, [gameId, seasonId])).id;
    await client.query(
      `insert into tournament_matches (tournament_id, stage, round_name, scheduled_at, home_player_title, away_player_title, home_school_id) values ($1, 'other', 'R1', now(), 'h', 'a', $2)`,
      [tournament, bracket],
    );
    expect(await count(`select 1 from teams where school_id in ('${archived}', '${bracket}')`)).toBe(0);

    await rerunMigration();
    expect(await count(`select 1 from teams where school_id = '${archived}' and season_id = '${seasonId}'`)).toBe(1);
    // Tournament games do not need membership for brackets, so a bracket-only school gets no row.
    expect(await count(`select 1 from teams where school_id = '${bracket}'`)).toBe(0);
    await rerunMigration();
    expect(await count(`select 1 from teams where school_id in ('${archived}', '${bracket}')`)).toBe(1);
  });
});
