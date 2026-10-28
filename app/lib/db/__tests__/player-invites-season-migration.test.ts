/**
 * Migration 0056 against an in-memory PGlite built from db/migrations/*.sql (no real database):
 * the column, its FK behaviour, and the legacy backfill rules.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '@/db/__tests__/helpers/pglite-migrations';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const migrationsDir = resolve(__dirname, '../../../../db/migrations');
const SQL = readFileSync(resolve(migrationsDir, '0056_player_invites_season.sql'), 'utf8');

let db: PGlite;
const q = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as Record<string, any>[];
const seasonOf = async (inviteId: string) => (await q('select season_id from player_invites where id = $1', [inviteId]))[0].season_id;

async function addInvite(id: string, school: string, game: string, status: string, member: string | null) {
  await q(
    `insert into player_invites (id, school_id, game_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, status, expires_at, member_id)
     values ($1, $2, $3, $4, 'A', 'B', $5, $6, now(), $7)`,
    [id, school, game, `hash-${id}`, U(900), status, member],
  );
}

describe('player_invites.season_id migration (0056)', () => {
  beforeAll(async () => {
    db = new PGlite();
    const report = await applyMigrations(db);
    // The column and FK come from 0056 itself; nothing in it may be skipped.
    expect(report.skipped.filter((s) => s.file === '0056_player_invites_season')).toEqual([]);

    await q(`insert into schools (id, name, slug) values ($1, 'Alpha', 'alpha')`, [U(1)]);
    // Game A: two seasons (one active). Game B: a single season (inactive). Game C: two seasons, none active.
    for (const [g, slug] of [[U(10), 'a'], [U(11), 'b'], [U(12), 'c']] as const) {
      await q(`insert into games (id, slug, display_name, short_name) values ($1, $2, $2, $2)`, [g, slug]);
    }
    await q(`insert into seasons (id, game_id, name, is_active) values ($1, $2, '2025-26', false), ($3, $2, '2026-27', true)`, [U(20), U(10), U(21)]);
    await q(`insert into seasons (id, game_id, name, is_active) values ($1, $2, '2025-26', false)`, [U(22), U(11)]);
    await q(`insert into seasons (id, game_id, name, is_active) values ($1, $2, '2024-25', false), ($3, $2, '2025-26', false)`, [U(23), U(12), U(24)]);

    await q(`insert into members (id, school_id, first_name, last_name) values ($1, $3, 'P', 'One'), ($2, $3, 'P', 'Two')`, [U(30), U(31), U(1)]);
    await q(`insert into teams (id, school_id, game_id, season_id) values ($1, $3, $4, $5), ($2, $3, $4, $6)`, [U(40), U(41), U(1), U(10), U(20), U(21)]);
    await q(`insert into rosters (id, team_id, name, division) values ($1, $3, 'Varsity', 'A'), ($2, $4, 'Varsity', 'A')`, [U(50), U(51), U(40), U(41)]);
    // P One played only in the past season; P Two was rostered in both seasons.
    await q(
      `insert into players (roster_id, member_id, role) values ($1, $3, 'player'), ($1, $4, 'player'), ($2, $4, 'player')`,
      [U(50), U(51), U(30), U(31)],
    );

    await addInvite(U(60), U(1), U(10), 'accepted', U(30)); // exactly one team -> its season
    await addInvite(U(61), U(1), U(10), 'accepted', U(31)); // two teams, game has two seasons -> unplaceable
    await addInvite(U(62), U(1), U(10), 'submitted', null); // open queue -> the game's active season
    await addInvite(U(63), U(1), U(12), 'pending', null); // open queue, no active season, two seasons -> unplaceable
    await addInvite(U(64), U(1), U(11), 'rejected', null); // game with a single season -> that season
    await addInvite(U(65), U(1), U(11), 'pending', null); // open queue, no active season, single season -> that season
    await addInvite(U(66), U(1), U(10), 'expired', null); // closed, game has two seasons -> unplaceable
    // The seeded rows were inserted after 0056 ran, so run its backfill statements now.
    const statements = SQL.split('--> statement-breakpoint').map((x) => x.trim()).filter(Boolean);
    for (const st of statements.slice(3)) await db.exec(st);
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it('adds a nullable season_id column with an index', async () => {
    const col = await q(`select is_nullable from information_schema.columns where table_name = 'player_invites' and column_name = 'season_id'`);
    expect(col[0].is_nullable).toBe('YES');
    const idx = await q(`select 1 from pg_indexes where indexname = 'player_invites_season_id_idx'`);
    expect(idx).toHaveLength(1);
  });

  it('places an accepted invite by the single team its student is on', async () => {
    expect(await seasonOf(U(60))).toBe(U(20));
  });

  it('places open (pending / submitted) invites in the only active season of the game', async () => {
    expect(await seasonOf(U(62))).toBe(U(21));
  });

  it('places any invite of a single-season game in that season', async () => {
    expect(await seasonOf(U(64))).toBe(U(22));
    expect(await seasonOf(U(65))).toBe(U(22));
  });

  it('leaves unplaceable rows null (managers never see them)', async () => {
    for (const id of [U(61), U(63), U(66)]) expect(await seasonOf(id)).toBeNull();
  });

  it('is idempotent and never overwrites an existing season', async () => {
    await q('update player_invites set season_id = $1 where id = $2', [U(20), U(62)]);
    const statements = SQL.split('--> statement-breakpoint').map((x) => x.trim()).filter(Boolean);
    for (const st of statements.slice(3)) await db.exec(st);
    expect(await seasonOf(U(62))).toBe(U(20));
    expect(await seasonOf(U(60))).toBe(U(20));
  });

  it('keeps the invite but clears its season when the season is deleted', async () => {
    await addInvite(U(70), U(1), U(11), 'submitted', null);
    await q('update player_invites set season_id = $1 where id = $2', [U(22), U(70)]);
    await q('delete from player_invites where id = $1', [U(64)]);
    await q('delete from seasons where id = $1', [U(22)]);
    expect(await seasonOf(U(70))).toBeNull();
  });

  it('is registered in the journal after every earlier entry', () => {
    const journal = JSON.parse(readFileSync(resolve(migrationsDir, 'meta/_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string; when: number }[];
    };
    const entry = journal.entries.find((e) => e.tag === '0056_player_invites_season');
    expect(entry).toBeDefined();
    for (const other of journal.entries.filter((e) => e.idx < entry!.idx)) {
      expect(entry!.when).toBeGreaterThan(other.when);
    }
    expect(new Set(journal.entries.map((e) => e.idx)).size).toBe(journal.entries.length);
  });
});
