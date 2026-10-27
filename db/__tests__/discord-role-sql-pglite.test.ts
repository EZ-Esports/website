/**
 * Rehearsal of the REAL SQL behind the Discord tier-role sync, run against an in-memory PGlite
 * built from db/migrations/*.sql (no other database is touched):
 *   - `loadDiscordUserId` and `loadMemberships` in app/lib/onboarding/tier-role-sync.ts, which are
 *     Drizzle queries (the app `db` is pointed at the PGlite through the drizzle pglite driver), and
 *   - `loadMembersFrom` / `loadMembershipsFor` in db/sync-discord-roles.ts, which are raw SQL.
 * Both must pick the same Discord id and produce the same desired roles for every member.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/app/lib/db/schema';
import { applyMigrations, type MigrationReport } from './helpers/pglite-migrations';
import { loadMembersFrom, loadMembershipsFor, type SqlLike } from '../sync-discord-roles';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/app/lib/db', () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) => {
        const target = holder.db as Record<string | symbol, unknown>;
        const v = target[prop];
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    }
  ),
}));

import { loadDiscordUserId, loadMemberships } from '@/app/lib/onboarding/tier-role-sync';
import { previewTierSync, runTierRoleSync } from '@/app/lib/onboarding/tier-role-sync-core';
import { desiredRoleIds, type TierRoleMap } from '@/app/lib/onboarding/tier-roles';
import { DiscordRestAdapter } from '@/app/lib/onboarding/adapters/discord-rest';
import { GUILD, MANAGE_ROLES, createFakeGuild } from '@/app/lib/onboarding/__tests__/helpers/fake-guild';

const VAL_V = '800000000000000011';
const VAL_J = '800000000000000012';
const LOL_V = '800000000000000013';
const LOL_J = '800000000000000014';
const BOT_ROLE = '800000000000000010';
const ROLES: TierRoleMap = {
  valorant: { varsity: VAL_V, jv: VAL_J },
  'league-of-legends': { varsity: LOL_V, jv: LOL_J },
};
const MANAGED = [VAL_V, VAL_J, LOL_V, LOL_J];

const D = {
  ana: '700000000000000001', // Valorant Varsity + LoL JV
  coach: '700000000000000002',
  sub: '700000000000000003',
  past: '700000000000000004',
  twoOld: '700000000000000005', // older identity of the member with two
  twoNew: '700000000000000006', // freshest identity: must win
  garbageFresh: 'not-a-snowflake', // freshest but invalid
  garbageOlderValid: '700000000000000007',
  academy: '700000000000000008',
};

let pg: PGlite;
let migrationReport: MigrationReport;
const m: Record<string, string> = {};

function sqlOf(q: PGlite): SqlLike {
  return { unsafe: async (text, params) => (await q.query(text, params)).rows as Record<string, unknown>[] };
}

beforeAll(async () => {
  pg = new PGlite();
  migrationReport = await applyMigrations(pg);
  holder.db = drizzle(pg, { schema });

  const id = async (text: string, params: unknown[] = []) => ((await pg.query(text, params)).rows[0] as { id: string }).id;
  const school = await id(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`);
  const val = await id(`insert into games (slug, display_name, short_name) values ('valorant', 'Valorant', 'VAL') returning id`);
  const lol = await id(`insert into games (slug, display_name, short_name) values ('league-of-legends', 'League of Legends', 'LoL') returning id`);
  const valActive = await id(`insert into seasons (game_id, name, is_active) values ($1, '2026-27', true) returning id`, [val]);
  const valPast = await id(`insert into seasons (game_id, name, is_active) values ($1, '2025-26', false) returning id`, [val]);
  const lolActive = await id(`insert into seasons (game_id, name, is_active) values ($1, '2026-27', true) returning id`, [lol]);
  const team = (game: string, season: string) =>
    id(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [school, game, season]);
  const roster = (t: string, name: string, division: string) =>
    id(`insert into rosters (team_id, name, division) values ($1, $2, $3) returning id`, [t, name, division]);
  const tValActive = await team(val, valActive);
  const tValPast = await team(val, valPast);
  const tLol = await team(lol, lolActive);
  const rValVarsity = await roster(tValActive, 'Varsity', 'A');
  const rValJv = await roster(tValActive, 'JV', 'B');
  const rValAcademy = await roster(tValActive, 'Academy', 'B');
  const rValPast = await roster(tValPast, 'Varsity', 'A');
  const rLolJv = await roster(tLol, 'JV', 'B');

  const member = (first: string, last: string, email: string) =>
    id(`insert into members (first_name, last_name, email, school_id) values ($1, $2, $3, $4) returning id`, [first, last, email, school]);
  for (const [key, first, last] of [
    ['ana', 'Ana', 'Lee'], ['coach', 'Cora', 'Coach'], ['sub', 'Sam', 'Sub'], ['past', 'Pat', 'Past'],
    ['two', 'Tia', 'Two'], ['garbage', 'Gus', 'Garbage'], ['academy', 'Amy', 'Academy'], ['none', 'Nia', 'None'],
    ['riotOnly', 'Rae', 'Riot'],
  ] as const) {
    m[key] = await member(first, last, `${key}@x.org`);
  }

  const player = (mem: string, ros: string, role = 'player', captain = false) =>
    pg.query(`insert into players (roster_id, member_id, role, is_captain) values ($1, $2, $3::player_role, $4)`, [ros, mem, role, captain]);
  await player(m.ana, rValVarsity, 'captain', true);
  await player(m.ana, rLolJv);
  await player(m.coach, rValVarsity, 'coach');
  await player(m.sub, rValJv, 'sub');
  await player(m.past, rValPast);
  await player(m.academy, rValAcademy);
  await player(m.two, rValVarsity);
  await player(m.garbage, rValJv);

  const ident = (mem: string, provider: string, pid: string, verified: string) =>
    pg.query(
      `insert into player_identities (member_id, provider, provider_user_id, provider_username, last_verified_at) values ($1, $2, $3, 'u', $4::timestamp)`,
      [mem, provider, pid, verified]
    );
  await ident(m.ana, 'discord', D.ana, '2026-09-01');
  await ident(m.ana, 'riot', 'Ana#EUW', '2026-10-01'); // a newer non-Discord identity must be ignored
  await ident(m.coach, 'discord', D.coach, '2026-09-01');
  await ident(m.sub, 'discord', D.sub, '2026-09-01');
  await ident(m.past, 'discord', D.past, '2026-09-01');
  await ident(m.two, 'discord', D.twoOld, '2026-08-01');
  await ident(m.two, 'discord', D.twoNew, '2026-10-20');
  await ident(m.garbage, 'discord', D.garbageOlderValid, '2026-08-01');
  await ident(m.garbage, 'discord', D.garbageFresh, '2026-10-20');
  await ident(m.academy, 'discord', D.academy, '2026-09-01');
  await ident(m.riotOnly, 'riot', 'Rae#NA1', '2026-09-01');
}, 120_000);

afterAll(async () => {
  await pg.close();
});

describe('PGlite rehearsal of the Discord role sync SQL', () => {
  it('the migrations load faithfully, so the rehearsal mirrors production DDL', () => {
    expect(migrationReport.skipped).toEqual([]);
  });

  it('loadMemberships (Drizzle) returns the joined facts for every roster, across games and seasons', async () => {
    const facts = await loadMemberships(m.ana);
    expect(facts).toHaveLength(2);
    expect(facts).toEqual(
      expect.arrayContaining([
        { gameSlug: 'valorant', rosterName: 'Varsity', seasonIsActive: true, playerRole: 'captain' },
        { gameSlug: 'league-of-legends', rosterName: 'JV', seasonIsActive: true, playerRole: 'player' },
      ])
    );
    expect(await loadMemberships(m.past)).toEqual([{ gameSlug: 'valorant', rosterName: 'Varsity', seasonIsActive: false, playerRole: 'player' }]);
    expect(await loadMemberships(m.none)).toEqual([]);
  });

  it('desired roles through the real SQL: games independent, coach excluded, past season and Academy ignored, subs count', async () => {
    const desired = async (key: string) => desiredRoleIds(await loadMemberships(m[key]), ROLES).sort();
    expect(await desired('ana')).toEqual([VAL_V, LOL_J].sort());
    expect(await desired('coach')).toEqual([]);
    expect(await desired('sub')).toEqual([VAL_J]);
    expect(await desired('past')).toEqual([]);
    expect(await desired('academy')).toEqual([]);
    expect(await desired('none')).toEqual([]);
  });

  it('loadDiscordUserId (Drizzle) picks the freshest VALID Discord id and ignores other providers', async () => {
    expect(await loadDiscordUserId(m.ana)).toBe(D.ana);
    expect(await loadDiscordUserId(m.two)).toBe(D.twoNew);
    expect(await loadDiscordUserId(m.garbage)).toBe(D.garbageOlderValid);
    expect(await loadDiscordUserId(m.riotOnly)).toBeNull();
    expect(await loadDiscordUserId(m.none)).toBeNull();
  });

  it('the script SQL (loadMembersFrom) agrees with the service queries for every member', async () => {
    const scriptMembers = await loadMembersFrom(sqlOf(pg));
    const byId = new Map(scriptMembers.map((s) => [s.id, s]));
    for (const [key, id] of Object.entries(m)) {
      const viaService = await loadDiscordUserId(id);
      const viaScript = byId.get(id);
      expect(viaScript?.discordUserId ?? null, key).toBe(viaService);
      if (viaScript) {
        expect(desiredRoleIds(viaScript.memberships, ROLES).sort(), key).toEqual(desiredRoleIds(await loadMemberships(id), ROLES).sort());
      }
    }
    expect(scriptMembers).toHaveLength(7); // members with a valid Discord identity
  });

  it('the script per-student re-read (loadMembershipsFor) returns what the bulk read does', async () => {
    const bulk = (await loadMembersFrom(sqlOf(pg))).find((s) => s.id === m.ana)!;
    expect((await loadMembershipsFor(sqlOf(pg), m.ana)).sort((a, b) => a.gameSlug.localeCompare(b.gameSlug))).toEqual(
      [...bulk.memberships].sort((a, b) => a.gameSlug.localeCompare(b.gameSlug))
    );
    expect(await loadMembershipsFor(sqlOf(pg), m.none)).toEqual([]);
  });

  it('previewTierSync over the real loaders: connected members exist and some keep a tier role, so no strip-all', async () => {
    const preview = await previewTierSync(Object.values(m), { roles: ROLES, loadDiscordUserId, loadMemberships });
    expect(preview).toEqual({ members: 9, withDiscord: 7, withTierRoles: 4, stripAll: false });
    // Same data, but a config that maps no game that exists: nobody would hold a role.
    const none = await previewTierSync(Object.values(m), { roles: { tetris: { varsity: VAL_V } }, loadDiscordUserId, loadMemberships });
    expect(none).toMatchObject({ withDiscord: 7, withTierRoles: 0, stripAll: true });
  });

  it('end to end: real queries + real adapter + fake guild converge the roles, and a second run changes nothing', async () => {
    const guild = createFakeGuild({
      roles: [
        { id: GUILD, position: 0, permissions: '0' },
        { id: BOT_ROLE, position: 20, permissions: MANAGE_ROLES },
        ...MANAGED.map((r, i) => ({ id: r, position: 1 + i, permissions: '0' })),
        { id: '800000000000000099', position: 2, permissions: '0' },
      ],
      botRoleIds: [BOT_ROLE],
      members: {
        [D.ana]: ['800000000000000099', VAL_J], // staff role must survive; stale JV must go
        [D.coach]: [VAL_V], // a coach does not hold a tier role: it is removed
        [D.sub]: [],
        [D.past]: [LOL_V],
        [D.twoNew]: [],
        [D.garbageOlderValid]: [VAL_J],
        [D.academy]: [],
      },
    });
    const adapter = new DiscordRestAdapter({ botToken: 'tok', guildId: GUILD, fetchImpl: guild.fetchImpl, sleep: async () => {} });
    const run = () =>
      runTierRoleSync(Object.values(m), { roles: ROLES, managed: MANAGED, loadDiscordUserId, loadMemberships, adapter, log: () => {} });

    const first = await run();
    expect(first).toMatchObject({ status: 'ok', failed: 0, skippedNoDiscord: 2 });
    expect(guild.rolesOf(D.ana)?.sort()).toEqual(['800000000000000099', VAL_V, LOL_J].sort());
    expect(guild.rolesOf(D.coach)).toEqual([]);
    expect(guild.rolesOf(D.sub)).toEqual([VAL_J]);
    expect(guild.rolesOf(D.past)).toEqual([]);
    expect(guild.rolesOf(D.twoNew)).toEqual([VAL_V]);
    expect(guild.rolesOf(D.garbageOlderValid)).toEqual([VAL_J]);
    expect(guild.rolesOf(D.academy)).toEqual([]);

    const writesAfterFirst = guild.writes.length;
    const second = await run();
    expect(second).toMatchObject({ synced: 0, failed: 0 });
    expect(guild.writes.length).toBe(writesAfterFirst);
  });
});
