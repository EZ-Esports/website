/**
 * Migration 0060 (spec-060, EXPAND + BACKFILL + CONSTRAIN in one file) against an in-memory PGlite built from
 * db/migrations/*.sql. Nothing else is touched. The database is first built up to the migration before it (a legacy
 * schema where rosters only know their team), seeded with legacy rows, and then the real 0060 file is run on it.
 * Covers the backfill, the constraints, idempotent re-runs, the BEFORE INSERT trigger, the critical property that
 * removing a team row can never delete rosters, and that the file is safe to run as ONE transaction.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const MIGRATION = readFileSync(resolve(__dirname, '../../../../db/migrations/0060_rosters_scope_expand_constrain.sql'), 'utf8');
const statementsOf = (sql: string) =>
  sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

let client: PGlite;
let gameId: string;
let seasonId: string;
let schoolA: string;
let schoolB: string;
let legacyRoster: string;
let legacyTeam: string;
let archived: string;
let bracket: string;
let misnamedTeam: string;
let n = 0;

async function one<T = { id: string }>(text: string, params: unknown[] = []) {
  return (await client.query(text, params)).rows[0] as T;
}
async function count(text: string, params: unknown[] = []) {
  return Number((await one<{ c: string }>(`select count(*)::int as c from (${text}) q`, params)).c);
}
/** Runs the migration exactly as the migrator would: statement by statement. */
async function runMigration() {
  for (const statement of statementsOf(MIGRATION)) await client.exec(statement);
}
const school = async (name: string) => (await one(`insert into schools (name, slug) values ($1, $1) returning id`, [name])).id;
const team = async (schoolId: string, season = seasonId) =>
  (await one(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [schoolId, gameId, season])).id;

beforeAll(async () => {
  client = new PGlite();
  // The schema as it stands just before 0060: rosters know only their team.
  await applyMigrations(client, { through: '0058_school_email_student_id' });
  gameId = (await one(`insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`)).id;
  seasonId = (await one(`insert into seasons (game_id, name) values ($1, '2026-27') returning id`, [gameId])).id;
  schoolA = await school('Alpha HS');
  schoolB = await school('Beta HS');
  // Legacy data the backfill has to carry over.
  legacyTeam = await team(await school('Delta HS'));
  legacyRoster = (await one(`insert into rosters (team_id, name, division) values ($1, 'Legacy', 'A') returning id`, [legacyTeam])).id;
  // Rosters that exist under another name or spelling must not be duplicated by the provisioning step.
  misnamedTeam = await team(await school('Echo HS'));
  await client.query(`insert into rosters (team_id, name, division) values ($1, 'Varsity', 'B')`, [misnamedTeam]); // really the JV division
  const minecraft = (await one(`insert into games (slug, display_name, short_name) values ('minecraft', 'Minecraft', 'MC') returning id`)).id;
  const minecraftSeason = (await one(`insert into seasons (game_id, name) values ($1, '2026-27') returning id`, [minecraft])).id;
  await (one(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [await school('Foxtrot HS'), minecraft, minecraftSeason]));
  const osu = (await one(`insert into games (slug, display_name, short_name) values ('osu', 'osu!', 'osu') returning id`)).id;
  const osuSeason = (await one(`insert into seasons (game_id, name) values ($1, '2026-27') returning id`, [osu])).id;
  await (one(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [await school('Golf HS'), osu, osuSeason]));
  archived = await school('Archive HS');
  bracket = await school('Bracket HS');
  await client.query(`insert into season_standings (season_id, school_id, division, rank) values ($1, $2, 'Varsity', 1)`, [seasonId, archived]);
  const tournament = (await one(`insert into tournaments (game_id, season_id, name, slug) values ($1, $2, 'Cup', 'cup') returning id`, [gameId, seasonId])).id;
  await client.query(
    `insert into tournament_matches (tournament_id, stage, round_name, scheduled_at, home_player_title, away_player_title, home_school_id) values ($1, 'other', 'R1', now(), 'h', 'a', $2)`,
    [tournament, bracket],
  );
});

afterAll(async () => {
  await client.close();
});

describe('one transaction: a failure rolls the whole backfill back', () => {
  it('leaves the database exactly as it was when a later statement fails', async () => {
    await client.exec('BEGIN');
    for (const statement of statementsOf(MIGRATION)) await client.exec(statement);
    // Inside the transaction the new state is visible...
    expect(await count(`select 1 from information_schema.columns where table_name = 'rosters' and column_name = 'school_id'`)).toBe(1);
    await expect(client.exec('select 1/0')).rejects.toThrow();
    await client.exec('ROLLBACK');
    // ...and after the rollback none of it happened: no columns, no membership rows, no trigger.
    expect(await count(`select 1 from information_schema.columns where table_name = 'rosters' and column_name = 'school_id'`)).toBe(0);
    expect(await count(`select 1 from teams where school_id = '${archived}'`)).toBe(0);
    expect(await count(`select 1 from pg_trigger where tgname = 'rosters_fill_scope_trg'`)).toBe(0);
  });

  it('applies cleanly inside BEGIN / COMMIT', async () => {
    await client.exec('BEGIN');
    for (const statement of statementsOf(MIGRATION)) await client.exec(statement);
    await client.exec('COMMIT');
    expect(await count(`select 1 from information_schema.columns where table_name = 'rosters' and column_name = 'school_id'`)).toBe(1);
  });
});

describe('0060: schema after the single migration', () => {
  it('makes the three scope columns mandatory and indexed, with team_id nullable', async () => {
    const cols = (
      await client.query(`select column_name, is_nullable from information_schema.columns where table_name = 'rosters' and column_name in ('school_id','game_id','season_id','team_id') order by 1`)
    ).rows as Array<{ column_name: string; is_nullable: string }>;
    expect(Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]))).toEqual({
      game_id: 'NO', school_id: 'NO', season_id: 'NO', team_id: 'YES',
    });
    const idx = (await client.query(`select indexname from pg_indexes where tablename = 'rosters'`)).rows.map((r: any) => r.indexname);
    expect(idx).toEqual(
      expect.arrayContaining(['rosters_school_game_season_idx', 'rosters_season_id_idx', 'rosters_team_name_unique_idx', 'rosters_scope_name_unique_idx']),
    );
  });

  it('drops the foreign key from rosters to teams', async () => {
    expect(
      await count(`select 1 from pg_constraint where conrelid = 'public.rosters'::regclass and contype = 'f' and confrelid = 'public.teams'::regclass`),
    ).toBe(0);
  });

  it('creates the season_schools compatibility view over teams', async () => {
    expect((await one<{ relkind: string }>(`select relkind from pg_class where oid = to_regclass('public.season_schools')`)).relkind).toBe('v');
  });
});

describe('backfill', () => {
  it('filled the legacy roster from its team', async () => {
    const r = await one<{ school_id: string; game_id: string; season_id: string }>(`select school_id, game_id, season_id from rosters where id = $1`, [legacyRoster]);
    const t = await one<{ school_id: string; game_id: string; season_id: string }>(`select school_id, game_id, season_id from teams where id = $1`, [legacyTeam]);
    expect(r).toEqual(t);
    expect(await count(`select 1 from rosters where school_id is null or game_id is null or season_id is null`)).toBe(0);
  });

  it('created a membership row for an archived standing, and none for a tournament-only school', async () => {
    expect(await count(`select 1 from teams where school_id = '${archived}' and season_id = '${seasonId}'`)).toBe(1);
    expect(await count(`select 1 from teams where school_id = '${bracket}'`)).toBe(0);
  });

  it('is idempotent: running the whole file again changes nothing', async () => {
    const before = [await count(`select 1 from rosters`), await count(`select 1 from teams`)];
    await runMigration();
    expect([await count(`select 1 from rosters`), await count(`select 1 from teams`)]).toEqual(before);
    expect(await count(`select 1 from teams where school_id in ('${archived}', '${bracket}')`)).toBe(1);
  });
});

describe('step 6: rosters every existing membership lacks', () => {
  const rostersOf = async (schoolName: string, gameSlug = 'valorant') =>
    (
      await client.query(
        `select r.name, r.division, r.team_id from rosters r join schools s on s.id = r.school_id join games g on g.id = r.game_id
         where s.name = $1 and g.slug = $2 order by r.name`,
        [schoolName, gameSlug],
      )
    ).rows as Array<{ name: string; division: string; team_id: string }>;

  it('adds only the missing division to a membership that has one roster (Varsity exists, JV added)', async () => {
    const rows = await rostersOf('Delta HS');
    expect(rows.map((x) => [x.name, x.division])).toEqual([['JV', 'B'], ['Legacy', 'A']]);
  });

  it('does not duplicate a division that exists under another name or spelling, and avoids a taken name', async () => {
    // "Varsity" stored as division B is the JV roster, so only the Varsity division is missing; its name is taken.
    const rows = await rostersOf('Echo HS');
    expect(rows.map((x) => [x.name, x.division])).toEqual([['Varsity', 'B'], ['Varsity 2', 'A']]);
  });

  it('gives Minecraft Varsity only and a tournament game a single All', async () => {
    expect((await rostersOf('Foxtrot HS', 'minecraft')).map((x) => [x.name, x.division])).toEqual([['Varsity', 'A']]);
    expect((await rostersOf('Golf HS', 'osu')).map((x) => [x.name, x.division])).toEqual([['All', 'All']]);
  });

  it('also provisions memberships created from archived standings, and sets team_id for old code', async () => {
    const rows = await rostersOf('Archive HS');
    expect(rows.map((x) => [x.name, x.division])).toEqual([['JV', 'B'], ['Varsity', 'A']]);
    const archivedTeam = (await one<{ id: string }>(`select id from teams where school_id = '${archived}'`)).id;
    expect(rows.every((x) => x.team_id === archivedTeam)).toBe(true);
  });

  it('creates no membership for a tournament-only school, and no duplicates on a re-run', async () => {
    expect(await rostersOf('Bracket HS')).toEqual([]);
    const before = await count(`select 1 from rosters`);
    await runMigration();
    expect(await count(`select 1 from rosters`)).toBe(before);
    expect(await count(`select 1 from (select school_id, game_id, season_id, name from rosters group by 1,2,3,4 having count(*) > 1) d`)).toBe(0);
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
