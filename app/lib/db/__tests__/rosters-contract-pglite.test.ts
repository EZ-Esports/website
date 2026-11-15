/**
 * Migrations 0060 and 0061 (spec-060) and the new membership model, against an in-memory PGlite built from
 * db/migrations/*.sql. Nothing else is touched. Two schemas are exercised: the gap after 0060 (where
 * `season_schools` is a view over `teams`, so the new code works before the rename) and the final schema after 0061.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../index', () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/auth', () => ({ requirePermission: vi.fn(async () => ({ id: '00000000-0000-4000-8000-0000000000aa', email: 'staff@example.com' })) }));

const MIGRATIONS = resolve(__dirname, '../../../../db/migrations');
const sqlOf = (tag: string) => readFileSync(resolve(MIGRATIONS, `${tag}.sql`), 'utf8');
async function rerun(client: PGlite, tag: string) {
  for (const raw of sqlOf(tag).split('--> statement-breakpoint')) {
    const statement = raw.trim();
    if (statement) await client.exec(statement);
  }
}
async function one<T = { id: string }>(client: PGlite, text: string, params: unknown[] = []) {
  return (await client.query(text, params)).rows[0] as T;
}
async function count(client: PGlite, text: string, params: unknown[] = []) {
  return Number((await one<{ c: string }>(client, `select count(*)::int as c from (${text}) q`, params)).c);
}

describe('the gap after 0060: season_schools is a view over teams', () => {
  let client: PGlite;
  let game: string;
  let season: string;
  let schoolA: string;
  let schoolB: string;

  beforeAll(async () => {
    client = new PGlite();
    const report = await applyMigrations(client, { through: '0060_rosters_scope_expand_constrain' });
    expect(report.skipped.filter((s) => /0060|0061/.test(s.file))).toEqual([]);
    game = (await one(client, `insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`)).id;
    season = (await one(client, `insert into seasons (game_id, name) values ($1, '2026-27') returning id`, [game])).id;
    schoolA = (await one(client, `insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`)).id;
    schoolB = (await one(client, `insert into schools (name, slug) values ('Beta HS', 'beta') returning id`)).id;
  });
  afterAll(async () => {
    await client.close();
  });

  it('season_schools is a view, and insert / on-conflict / delete go through to teams', async () => {
    expect((await one<{ relkind: string }>(client, `select relkind from pg_class where relname = 'season_schools'`)).relkind).toBe('v');
    await client.query(`insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3)`, [schoolA, game, season]);
    expect(await count(client, `select 1 from teams where school_id = '${schoolA}'`)).toBe(1);
    // The same statement shape drizzle emits for find-or-create: a conflict is a no-op, not an error.
    await client.query(
      `insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3) on conflict (school_id, game_id, season_id) do nothing`,
      [schoolA, game, season],
    );
    expect(await count(client, `select 1 from season_schools where school_id = '${schoolA}'`)).toBe(1);
    await client.query(`delete from season_schools where school_id = $1`, [schoolA]);
    expect(await count(client, `select 1 from teams where school_id = '${schoolA}'`)).toBe(0);
  });

  it('rosters are mandatory-scoped and unique per school/game/season/name', async () => {
    await expect(client.query(`insert into rosters (name, division) values ('X', 'A')`)).rejects.toThrow(/null value|not-null/i);
    await client.query(`insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, 'Varsity', 'A')`, [schoolB, game, season]);
    await expect(
      client.query(`insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, 'Varsity', 'A')`, [schoolB, game, season]),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('a roster with a match cannot be deleted (RESTRICT), while an unplayed one can', async () => {
    const r1 = (await one(client, `select id from rosters where school_id = $1 and name = 'Varsity'`, [schoolB])).id;
    const r2 = (await one(client, `insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, 'Varsity', 'A') returning id`, [schoolA, game, season])).id;
    await client.query(`insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at) values ($1, $2, $3, now())`, [season, r1, r2]);
    await expect(client.query(`delete from rosters where id = $1`, [r1])).rejects.toThrow(/foreign key|violates/i);
    const spare = (await one(client, `insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, 'JV', 'B') returning id`, [schoolA, game, season])).id;
    await client.query(`delete from rosters where id = $1`, [spare]);
    expect(await count(client, `select 1 from rosters where id = '${spare}'`)).toBe(0);
  });

  it('roster_standings carries the scope columns', async () => {
    const row = await one<{ school_id: string; game_id: string; season_id: string }>(
      client,
      `select school_id, game_id, season_id from roster_standings where school_id = $1 limit 1`,
      [schoolB],
    );
    expect(row).toEqual({ school_id: schoolB, game_id: game, season_id: season });
  });

  it('the new code works end to end against the view: add, remove, restore and a public read', async () => {
    holder.db = drizzle(client, { schema });
    const { addSchoolToSeason, removeSchoolFromSeason } = await import('@/app/(admin)/admin/league/season-schools-actions');
    const sid = (await one(client, `insert into schools (name, slug) values ('Gamma HS', 'gamma') returning id`)).id;

    const added = await addSchoolToSeason({ seasonId: season, schoolId: sid });
    expect(added).toMatchObject({ success: true, teamCreated: true, rostersCreated: ['Varsity', 'JV'] });
    expect(await count(client, `select 1 from teams where school_id = '${sid}'`)).toBe(1); // written through the view
    expect(await count(client, `select 1 from rosters where school_id = '${sid}'`)).toBe(2);

    const removed = await removeSchoolFromSeason({ seasonId: season, schoolId: sid });
    expect(removed).toMatchObject({ success: true, alreadyRemoved: false });
    expect(await count(client, `select 1 from teams where school_id = '${sid}'`)).toBe(0);
    expect(await count(client, `select 1 from rosters where school_id = '${sid}'`)).toBe(2);

    const restored = await addSchoolToSeason({ seasonId: season, schoolId: sid });
    expect(restored).toMatchObject({ success: true, teamCreated: true, restored: true, rostersCreated: [] });
    expect(await count(client, `select 1 from rosters where school_id = '${sid}'`)).toBe(2);

    const { buildSeasonStandingsComputedQuery } = await import('../standings');
    const rows = await buildSeasonStandingsComputedQuery({ seasonId: season, division: 'Varsity', combined: false });
    expect(rows.map((r) => r.schoolName)).toContain('Gamma HS');
  });

  it('0060 is idempotent: running it again changes nothing and errors on nothing', async () => {
    await rerun(client, '0060_rosters_scope_expand_constrain');
    expect((await one<{ relkind: string }>(client, `select relkind from pg_class where relname = 'season_schools'`)).relkind).toBe('v');
  });
});

describe('the final schema after 0061', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  let game: string;
  let season: string;
  let schoolA: string;
  let schoolB: string;
  let rosterA: string;
  let rosterB: string;

  beforeAll(async () => {
    client = new PGlite();
    const report = await applyMigrations(client);
    expect(report.skipped).toEqual([]);
    db = drizzle(client, { schema });
    holder.db = db;
    game = (await one(client, `insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`)).id;
    season = (
      await one(client, `insert into seasons (game_id, name, is_active, outcomes_finalized_at) values ($1, '2026-27', true, now()) returning id`, [game])
    ).id;
    schoolA = (await one(client, `insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`)).id;
    schoolB = (await one(client, `insert into schools (name, slug) values ('Beta HS', 'beta') returning id`)).id;
    for (const s of [schoolA, schoolB]) {
      await client.query(`insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3)`, [s, game, season]);
    }
    const roster = async (s: string, name = 'Varsity', div = 'A') =>
      (await one(client, `insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, '${name}', '${div}') returning id`, [s, game, season])).id;
    rosterA = await roster(schoolA);
    rosterB = await roster(schoolB);
    await roster(schoolA, 'JV', 'B');
    await roster(schoolB, 'JV', 'B');
    await client.query(
      `insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, home_score, away_score, status) values ($1, $2, $3, now(), 2, 0, 'completed')`,
      [season, rosterA, rosterB],
    );
  });
  afterAll(async () => {
    await client.close();
  });

  it('season_schools is a real table, rosters.team_id and the trigger are gone, teams no longer exists', async () => {
    expect((await one<{ relkind: string }>(client, `select relkind from pg_class where relname = 'season_schools'`)).relkind).toBe('r');
    expect(await count(client, `select 1 from information_schema.columns where table_name = 'rosters' and column_name = 'team_id'`)).toBe(0);
    expect(await count(client, `select 1 from pg_trigger where tgname = 'rosters_fill_scope_trg'`)).toBe(0);
    expect(await count(client, `select 1 from pg_class where relname = 'teams' and relkind in ('r','v')`)).toBe(0);
  });

  it('0061 can be re-run on the final schema without error or change', async () => {
    const before = [await count(client, `select 1 from rosters`), await count(client, `select 1 from season_schools`)];
    await rerun(client, '0061_rosters_scope_contract');
    expect([await count(client, `select 1 from rosters`), await count(client, `select 1 from season_schools`)]).toEqual(before);
  });

  it('removing a school deletes only its membership row: rosters and matches stay', async () => {
    const { removeSchoolFromSeason } = await import('@/app/(admin)/admin/league/season-schools-actions');
    const res = await removeSchoolFromSeason({ seasonId: season, schoolId: schoolB });
    expect(res).toMatchObject({ success: true, alreadyRemoved: false, hiddenMatches: 1 });
    expect(await removeSchoolFromSeason({ seasonId: season, schoolId: schoolB })).toMatchObject({ alreadyRemoved: true });
    expect(await count(client, `select 1 from staff_audit_logs where event = 'remove_school_from_season'`)).toBe(1);
    expect(await count(client, `select 1 from season_schools where school_id = '${schoolB}'`)).toBe(0);
    expect(await count(client, `select 1 from rosters where school_id = '${schoolB}'`)).toBe(2);
    expect(await count(client, `select 1 from matches`)).toBe(1);
  });

  it('the public match list hides a match once either school is not a member; staff reads still see it', async () => {
    const { getMatchesPage } = await import('../matches');
    const pub = await getMatchesPage({}, true);
    expect(pub.items).toHaveLength(0);
    const staff = await getMatchesPage({}, false);
    expect(staff.items).toHaveLength(1);
  });

  it('a removed school is gone from the public team directory and its standings rows', async () => {
    const { getGameTeamsPageData } = await import('../teams');
    const teams = await getGameTeamsPageData('valorant');
    expect(JSON.stringify(teams)).not.toContain('Beta HS');
    expect(JSON.stringify(teams)).toContain('Alpha HS');
    const { buildSeasonStandingsComputedQuery } = await import('../standings');
    const rows = await buildSeasonStandingsComputedQuery({ seasonId: season, division: 'Varsity', combined: false });
    expect(rows.map((r) => r.schoolName)).toEqual(['Alpha HS']);
  });

  it('adding the school back restores everything: same rosters, match visible again, no duplicates', async () => {
    const { addSchoolToSeason } = await import('@/app/(admin)/admin/league/season-schools-actions');
    const first = await addSchoolToSeason({ seasonId: season, schoolId: schoolB });
    expect(first).toMatchObject({ success: true, teamCreated: true, restored: true, rostersCreated: [] });
    expect(await addSchoolToSeason({ seasonId: season, schoolId: schoolB })).toMatchObject({ teamCreated: false, restored: false });
    expect(await count(client, `select 1 from season_schools where school_id = '${schoolB}'`)).toBe(1);
    expect(await count(client, `select 1 from rosters where school_id = '${schoolB}'`)).toBe(2);
    const { getMatchesPage } = await import('../matches');
    expect((await getMatchesPage({}, true)).items).toHaveLength(1);
  });

  it('every member school is visible, rosters or not; the dashboard count only looks at active seasons', async () => {
    const { getGameTeamsPageData, countTeamsWithoutRoster } = await import('../teams');
    const { getSeasonSetupData } = await import('../season-setup');
    const archived = (await one(client, `insert into seasons (game_id, name, is_active) values ($1, '2020-21', false) returning id`, [game])).id;
    const emptySchool = (await one(client, `insert into schools (name, slug) values ('Snapshot Only HS', 'snapshot-only') returning id`)).id;
    const before = await countTeamsWithoutRoster();
    // The membership 0060 backfills for an archived standings snapshot: no rosters at all.
    await client.query(`insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3)`, [emptySchool, game, archived]);
    // A school that really played the archived season (rosters, no JV).
    await client.query(`insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3)`, [schoolA, game, archived]);
    await client.query(`insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, 'Varsity', 'A')`, [schoolA, game, archived]);

    expect(await countTeamsWithoutRoster()).toBe(before); // archived seasons are not work to do

    const directory = await getGameTeamsPageData('valorant');
    // Visibility is season membership only: a member with no rosters is listed, with an empty season.
    const snapshotOnly = directory!.find((s) => s.schoolName === 'Snapshot Only HS')!;
    expect(snapshotOnly.seasons).toEqual([expect.objectContaining({ seasonName: '2020-21', rosters: [] })]);
    const { getSchoolGameTeamsPageData } = await import('../teams');
    const detail = await getSchoolGameTeamsPageData('valorant', 'snapshot-only');
    expect(detail!.seasons).toEqual([expect.objectContaining({ seasonName: '2020-21', rosters: [] })]);
    const alpha = directory!.find((s) => s.schoolName === 'Alpha HS')!;
    expect(alpha.seasons.map((s) => s.seasonName).sort()).toEqual(['2020-21', '2026-27']);

    const hub = await getSeasonSetupData(archived);
    expect(hub!.schools.map((s) => s.schoolName).sort()).toEqual(['Alpha HS', 'Snapshot Only HS']); // members are listed
    expect(hub!.schools.every((s) => s.missing.length === 0)).toBe(true); // but an archived season never asks for missing rosters
    expect(hub!.availableSchools.map((s) => s.name)).not.toContain('Snapshot Only HS'); // still a member, so not offered

    // An active season keeps asking: Beta HS has Varsity + JV, so give a school only Varsity.
    const only = (await one(client, `insert into schools (name, slug) values ('Varsity Only HS', 'varsity-only') returning id`)).id;
    await client.query(`insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3)`, [only, game, season]);
    await client.query(`insert into rosters (school_id, game_id, season_id, name, division) values ($1, $2, $3, 'Varsity', 'A')`, [only, game, season]);
    const live = await getSeasonSetupData(season);
    expect(live!.schools.find((s) => s.schoolName === 'Varsity Only HS')!.missing).toEqual(['JV']);
    expect(await countTeamsWithoutRoster()).toBe(before); // it has a roster, so still not counted
  });

  it('a player invite stops validating and submitting once its school is no longer in the invite season', async () => {
    const { findInviteForValidation, findInviteForSubmission } = await import('../onboarding');
    const invite = (hash: string, withSeason: boolean) =>
      client.query(
        `insert into player_invites (school_id, game_id, season_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, expires_at)
         values ($1, $2, $3, $4, 'A', 'B', '00000000-0000-4000-8000-0000000000aa', now() + interval '7 days')`,
        [schoolA, game, withSeason ? season : null, hash],
      );
    await invite('seasoned', true);
    await invite('legacy', false);

    expect((await findInviteForValidation('seasoned') as any).schoolInSeason).toBe(true);
    expect((await findInviteForSubmission('seasoned') as any).schoolInSeason).toBe(true);

    await client.query(`delete from season_schools where school_id = $1 and season_id = $2`, [schoolA, season]);
    expect((await findInviteForValidation('seasoned') as any).schoolInSeason).toBe(false);
    expect((await findInviteForSubmission('seasoned') as any).schoolInSeason).toBe(false);
    // Legacy invites without a season are not affected.
    expect((await findInviteForValidation('legacy') as any).schoolInSeason).toBe(true);

    await client.query(`insert into season_schools (school_id, game_id, season_id) values ($1, $2, $3)`, [schoolA, game, season]);
    expect((await findInviteForSubmission('seasoned') as any).schoolInSeason).toBe(true);
  });

  it('deleting a game with matches throws a recognisable refusal and removes nothing', async () => {
    const { deleteGameInDb } = await import('../league');
    const err = await deleteGameInDb(game).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DeleteRefusedError');
    expect(err.message).toMatch(/existing matches/);
    expect(await count(client, `select 1 from games where id = '${game}'`)).toBe(1);
  });

  it('deleting a season with matches is refused and removes nothing; without matches it removes rosters and players', async () => {
    const { deleteSeasonInDb } = await import('../league');
    await expect(deleteSeasonInDb(season)).rejects.toThrow(/existing matches/);
    expect(await count(client, `select 1 from rosters where season_id = '${season}'`)).toBeGreaterThanOrEqual(4);

    await client.query(`delete from matches`);
    const member = (await one(client, `insert into members (first_name, last_name, school_id) values ('A', 'B', $1) returning id`, [schoolA])).id;
    await client.query(`insert into players (roster_id, member_id) values ($1, $2)`, [rosterA, member]);
    await deleteSeasonInDb(season);
    expect(await count(client, `select 1 from rosters where season_id = '${season}'`)).toBe(0);
    expect(await count(client, `select 1 from rosters`)).toBe(1); // the archived season's roster is untouched
    expect(await count(client, `select 1 from players`)).toBe(0);
    expect(await count(client, `select 1 from members where id = '${member}'`)).toBe(1);
  });
});
