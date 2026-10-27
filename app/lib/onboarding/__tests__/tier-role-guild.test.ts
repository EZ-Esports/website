import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiscordRestAdapter,
  PREFLIGHT_FAILURE_TTL_MS,
  PREFLIGHT_SUCCESS_TTL_MS,
  invalidateTierPreflightCache,
} from '../adapters/discord-rest';
import { resetBlockedLog, runTierRoleSync, type TierSyncDeps } from '../tier-role-sync-core';
import type { RosterMembershipFact, TierRoleMap } from '../tier-roles';
import { ADMINISTRATOR, GUILD, MANAGE_ROLES, createFakeGuild, type FakeRole } from './helpers/fake-guild';

const BOT_ROLE = '800000000000000010';
const VARSITY = '800000000000000011';
const JV = '800000000000000012';
const STAFF = '800000000000000013';
const ROLES: TierRoleMap = { valorant: { varsity: VARSITY, jv: JV } };
const MANAGED = [VARSITY, JV];

const U1 = '800000000000000101';
const U2 = '800000000000000102';
const U3 = '800000000000000103';
const M1 = '00000001-0000-0000-0000-000000000000';
const M2 = '00000002-0000-0000-0000-000000000000';
const M3 = '00000003-0000-0000-0000-000000000000';

const fact = (rosterName: string): RosterMembershipFact => ({ gameSlug: 'valorant', rosterName, seasonIsActive: true, playerRole: 'player' });

function guildRoles(over: { botPos?: number; varsityPos?: number; jvPos?: number; botPerms?: string; everyonePerms?: string } = {}): FakeRole[] {
  return [
    { id: GUILD, position: 0, permissions: over.everyonePerms ?? '0' },
    { id: BOT_ROLE, position: over.botPos ?? 10, permissions: over.botPerms ?? MANAGE_ROLES },
    { id: VARSITY, position: over.varsityPos ?? 5, permissions: '0' },
    { id: JV, position: over.jvPos ?? 6, permissions: '0' },
    { id: STAFF, position: 2, permissions: '0' },
  ];
}

let clock = 1_000_000;
beforeEach(() => {
  clock = 1_000_000;
  invalidateTierPreflightCache();
  resetBlockedLog();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function setup(guild: ReturnType<typeof createFakeGuild>, memberships: Record<string, RosterMembershipFact[]>, discord: Record<string, string | null>, over: Partial<TierSyncDeps> = {}) {
  const adapter = new DiscordRestAdapter({ botToken: 'tok', guildId: GUILD, fetchImpl: guild.fetchImpl, sleep: async () => {}, now: () => clock });
  const logs: string[] = [];
  const deps: TierSyncDeps = {
    roles: ROLES,
    managed: MANAGED,
    loadDiscordUserId: async (id) => discord[id] ?? null,
    loadMemberships: async (id) => memberships[id] ?? [],
    adapter,
    log: (l) => logs.push(l),
    ...over,
  };
  return { adapter, deps, logs, run: (ids: string[]) => runTierRoleSync(ids, deps) };
}

describe('preflight (checkTierRolesAssignable)', () => {
  const check = (roles: FakeRole[], botRoleIds = [BOT_ROLE], managed = MANAGED) => {
    const guild = createFakeGuild({ roles, botRoleIds, members: {} });
    const adapter = new DiscordRestAdapter({ botToken: 'tok', guildId: GUILD, fetchImpl: guild.fetchImpl, sleep: async () => {}, now: () => clock });
    return { guild, adapter, result: () => adapter.checkTierRolesAssignable(managed) };
  };

  it('passes when the bot has Manage Roles and sits above every tier role', async () => {
    expect(await check(guildRoles()).result()).toEqual({ ok: true });
  });
  it('passes with Administrator instead of Manage Roles', async () => {
    expect(await check(guildRoles({ botPerms: ADMINISTRATOR })).result()).toEqual({ ok: true });
  });
  it('counts permissions granted by @everyone', async () => {
    expect(await check(guildRoles({ botPerms: '0', everyonePerms: MANAGE_ROLES })).result()).toEqual({ ok: true });
  });
  it('missing_manage_roles when neither Administrator nor Manage Roles is held', async () => {
    expect(await check(guildRoles({ botPerms: '0' })).result()).toEqual({ ok: false, reason: 'missing_manage_roles' });
  });
  it('role_not_below_bot when one tier role is above the bot, even though the other is below', async () => {
    expect(await check(guildRoles({ jvPos: 15 })).result()).toEqual({ ok: false, reason: 'role_not_below_bot' });
  });
  it('role_not_below_bot when a tier role is at the same position (must be strictly lower)', async () => {
    expect(await check(guildRoles({ varsityPos: 10 })).result()).toEqual({ ok: false, reason: 'role_not_below_bot' });
  });
  it('role_missing when a configured role id is not in the guild', async () => {
    const roles = guildRoles().filter((r) => r.id !== JV);
    expect(await check(roles).result()).toEqual({ ok: false, reason: 'role_missing' });
  });
  it('role_is_managed when a configured role belongs to an integration', async () => {
    const roles = guildRoles().map((r) => (r.id === JV ? { ...r, managed: true } : r));
    expect(await check(roles).result()).toEqual({ ok: false, reason: 'role_is_managed' });
  });
  it('the bot highest role is the max over all its roles', async () => {
    const roles = [...guildRoles({ botPos: 1, botPerms: MANAGE_ROLES }), { id: '800000000000000020', position: 20, permissions: '0' }];
    expect(await check(roles, [BOT_ROLE, '800000000000000020']).result()).toEqual({ ok: true });
  });

  describe('fails closed when it cannot complete', () => {
    it.each([
      ['5xx on /users/@me', 'GET /users/@me', 500],
      ['401 on /users/@me', 'GET /users/@me', 401],
      ['5xx on roles', `GET /guilds/${GUILD}/roles`, 503],
      ['403 on the bot member', `GET /guilds/${GUILD}/members/:id`, 403],
      ['persistent 429', 'GET /users/@me', 429],
    ])('%s -> preflight_failed', async (_n, key, status) => {
      const c = check(guildRoles());
      c.guild.state.status[key] = status;
      expect(await c.result()).toEqual({ ok: false, reason: 'preflight_failed' });
    });
    it('an unreadable bot identity (200 with no valid id) -> preflight_failed, never a pass', async () => {
      const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: {} });
      const fetchImpl = (async (url: string, init: RequestInit) =>
        String(url).endsWith('/users/@me')
          ? new Response(JSON.stringify({ id: 'not-an-id' }), { status: 200 })
          : String(url).endsWith('/members/not-an-id')
            ? new Response(JSON.stringify({ roles: [BOT_ROLE] }), { status: 200 }) // would pass if the id were trusted
            : guild.fetchImpl(url, init)) as unknown as typeof fetch;
      const adapter = new DiscordRestAdapter({ botToken: 'tok', guildId: GUILD, fetchImpl, sleep: async () => {}, now: () => clock });
      expect(await adapter.checkTierRolesAssignable(MANAGED)).toEqual({ ok: false, reason: 'preflight_failed' });
    });
    it('a network error -> preflight_failed (never throws)', async () => {
      const c = check(guildRoles());
      c.guild.state.throwNetwork = true;
      expect(await c.result()).toEqual({ ok: false, reason: 'preflight_failed' });
    });
  });

  describe('cache', () => {
    it('trusts a pass for 5 minutes, then asks Discord again', async () => {
      const c = check(guildRoles());
      await c.adapter.checkTierRolesAssignable(MANAGED);
      const first = c.guild.reads.length;
      expect(first).toBe(3);
      clock += PREFLIGHT_SUCCESS_TTL_MS - 1;
      await c.adapter.checkTierRolesAssignable(MANAGED);
      expect(c.guild.reads.length).toBe(first);
      clock += 2;
      await c.adapter.checkTierRolesAssignable(MANAGED);
      expect(c.guild.reads.length).toBe(first * 2);
    });
    it('trusts a failure for only about a minute, so a fix shows up quickly', async () => {
      const c = check(guildRoles({ botPerms: '0' }));
      await c.adapter.checkTierRolesAssignable(MANAGED);
      const first = c.guild.reads.length;
      clock += PREFLIGHT_FAILURE_TTL_MS - 1;
      await c.adapter.checkTierRolesAssignable(MANAGED);
      expect(c.guild.reads.length).toBe(first);
      clock += 2;
      await c.adapter.checkTierRolesAssignable(MANAGED);
      expect(c.guild.reads.length).toBe(first * 2);
    });
    it('is keyed by the configured role set', async () => {
      const c = check(guildRoles());
      await c.adapter.checkTierRolesAssignable(MANAGED);
      await c.adapter.checkTierRolesAssignable([VARSITY]);
      expect(c.guild.reads.length).toBe(6);
    });
  });
});

describe('fail closed: a blocked preflight changes nothing', () => {
  it('bot below one tier role (above the other): zero writes for the whole run, even for members only needing the allowed role', async () => {
    const guild = createFakeGuild({ roles: guildRoles({ jvPos: 15 }), botRoleIds: [BOT_ROLE], members: { [U1]: [], [U2]: [VARSITY, STAFF] } });
    const { run, logs } = setup(guild, { [M1]: [fact('Varsity')], [M2]: [] }, { [M1]: U1, [M2]: U2 });
    const report = await run([M1, M2]);
    expect(report).toMatchObject({ status: 'blocked', blockedReason: 'role_not_below_bot', synced: 0, failed: 0 });
    expect(guild.writes).toEqual([]);
    expect(guild.rolesOf(U1)).toEqual([]);
    expect(guild.rolesOf(U2)).toEqual([VARSITY, STAFF]);
    // Only the three preflight reads happened: no member was even looked at.
    expect(guild.reads).toHaveLength(3);
    expect(logs.join('\n')).toContain('role_not_below_bot');
  });

  it('logs each blocked reason once and never a role id or token', async () => {
    const guild = createFakeGuild({ roles: guildRoles({ botPerms: '0' }), botRoleIds: [BOT_ROLE], members: { [U1]: [] } });
    const { run, logs } = setup(guild, { [M1]: [fact('Varsity')] }, { [M1]: U1 });
    await run([M1]);
    clock += PREFLIGHT_FAILURE_TTL_MS + 1;
    await run([M1]);
    expect(logs.filter((l) => l.includes('missing_manage_roles'))).toHaveLength(1);
    expect(logs.join('\n')).not.toMatch(/\d{17,20}/);
    expect(logs.join('\n')).not.toContain('tok');
  });

  it('an unreachable Discord blocks with preflight_failed and writes nothing', async () => {
    const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [] } });
    guild.state.throwNetwork = true;
    const report = await setup(guild, { [M1]: [fact('Varsity')] }, { [M1]: U1 }).run([M1]);
    expect(report).toMatchObject({ status: 'blocked', blockedReason: 'preflight_failed' });
    expect(guild.writes).toEqual([]);
  });

  it('a throwing preflight is treated as blocked, not as a pass', async () => {
    const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [] } });
    const { deps } = setup(guild, { [M1]: [fact('Varsity')] }, { [M1]: U1 });
    const report = await runTierRoleSync([M1], {
      ...deps,
      adapter: { syncManagedRoles: vi.fn(), checkTierRolesAssignable: async () => { throw new Error('boom'); } },
    });
    expect(report).toMatchObject({ status: 'blocked', blockedReason: 'preflight_failed' });
  });
});

describe('ordering, partial failure and convergence', () => {
  it('moves Varsity -> JV by adding JV first, then removing Varsity, leaving other roles alone', async () => {
    const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [VARSITY, STAFF] } });
    const report = await setup(guild, { [M1]: [fact('JV')] }, { [M1]: U1 }).run([M1]);
    expect(report).toMatchObject({ status: 'ok', synced: 1, failed: 0 });
    expect(guild.writes.map((w) => `${w.method} ${w.roleId}`)).toEqual([`PUT ${JV}`, `DELETE ${VARSITY}`]);
    expect(guild.rolesOf(U1)?.sort()).toEqual([JV, STAFF].sort());
  });

  it('a partial failure (add ok, then 403) leaves the old role in place; the next sync converges once fixed', async () => {
    let broken = true;
    const guild = createFakeGuild({
      roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [VARSITY, STAFF] },
      failWrite: (_i, method) => (broken && method === 'DELETE' ? 403 : null),
    });
    const { run } = setup(guild, { [M1]: [fact('JV')] }, { [M1]: U1 });

    const first = await run([M1]);
    expect(first).toMatchObject({ status: 'ok', failed: 1 });
    expect(first.failures[0].reason).toBe('bot_misconfigured');
    // The member never ends up with neither role: the new one was added, the old one remains.
    expect(guild.rolesOf(U1)?.sort()).toEqual([VARSITY, JV, STAFF].sort());

    broken = false; // staff fix the bot's permissions
    const second = await run([M1]);
    expect(second).toMatchObject({ status: 'ok', synced: 1, failed: 0 });
    expect(guild.rolesOf(U1)?.sort()).toEqual([JV, STAFF].sort());
    // Only the missing step was performed the second time (JV was already there).
    expect(guild.writes.filter((w) => w.index > 2).map((w) => `${w.method} ${w.roleId}`)).toEqual([`DELETE ${VARSITY}`]);

    const third = await run([M1]);
    expect(third).toMatchObject({ synced: 0, unchanged: 1 });
  });
});

describe('abort on a persistent bot or role error', () => {
  it('a 403 on the first write stops the run: the remaining members are reported, not retried', async () => {
    const guild = createFakeGuild({
      roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [], [U2]: [], [U3]: [] },
      failWrite: () => 403,
    });
    const report = await setup(guild, { [M1]: [fact('Varsity')], [M2]: [fact('Varsity')], [M3]: [fact('Varsity')] }, { [M1]: U1, [M2]: U2, [M3]: U3 }).run([M1, M2, M3]);
    expect(guild.writes).toHaveLength(1);
    expect(report.failed).toBe(3);
    expect(report.failures.map((f) => f.reason)).toEqual(['bot_misconfigured', 'not_attempted_after_config_error', 'not_attempted_after_config_error']);
  });

  it('a missing role (404 code 10011) also stops the run', async () => {
    const ghost = '800000000000000099';
    const roles: TierRoleMap = { valorant: { varsity: ghost } };
    const guild2 = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [], [U2]: [] } });
    const { deps } = setup(guild2, { [M1]: [fact('Varsity')], [M2]: [fact('Varsity')] }, { [M1]: U1, [M2]: U2 });
    // Preflight would catch this (role_missing), so bypass it to prove the mid-run path.
    const report = await runTierRoleSync([M1, M2], {
      ...deps, roles, managed: [ghost],
      adapter: { checkTierRolesAssignable: async () => ({ ok: true }), syncManagedRoles: (id, input) => deps.adapter.syncManagedRoles(id, input) },
    });
    expect(guild2.writes).toHaveLength(1);
    expect(report.failures.map((f) => f.reason)).toEqual(['role_not_found', 'not_attempted_after_config_error']);
  });

  it('a 403 from a role call invalidates the cached preflight so the next run re-checks', async () => {
    let broken = true;
    const guild = createFakeGuild({
      roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [] },
      failWrite: () => (broken ? 403 : null),
    });
    const { run } = setup(guild, { [M1]: [fact('Varsity')] }, { [M1]: U1 });
    await run([M1]);
    const readsAfterFirst = guild.reads.length; // 3 preflight + 1 member read
    broken = false;
    await run([M1]);
    // Preflight re-ran (3 more reads) because the 403 dropped the cache, plus the member read.
    expect(guild.reads.length).toBe(readsAfterFirst + 3 + 1);
    expect(guild.rolesOf(U1)).toEqual([VARSITY]);
  });

  it('a healthy run reuses the cached preflight', async () => {
    const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [] } });
    const { run } = setup(guild, { [M1]: [fact('Varsity')] }, { [M1]: U1 });
    await run([M1]);
    const after1 = guild.reads.length;
    await run([M1]);
    expect(guild.reads.length).toBe(after1 + 1); // only the member read
  });
});

describe('overlapping syncs for one member', () => {
  it('when two runs interleave, the one that recomputes last decides the final roles', async () => {
    const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [] } });
    let roster = 'Varsity';
    let releaseB!: () => void;
    const bMayRead = new Promise<void>((r) => (releaseB = r));

    const common = { roles: ROLES, managed: MANAGED, log: () => {} };
    const adapterA = new DiscordRestAdapter({ botToken: 'tok', guildId: GUILD, fetchImpl: guild.fetchImpl, sleep: async () => {}, now: () => clock });

    // Run A: reads the old roster (Varsity) and finishes writing, then the roster changes.
    const runA = runTierRoleSync([M1], {
      ...common,
      adapter: adapterA,
      loadDiscordUserId: async () => U1,
      loadMemberships: async () => [fact(roster)],
    }).then((r) => {
      roster = 'JV'; // the manager moves the player while A was still in flight
      releaseB();
      return r;
    });

    // Run B: started concurrently, but recomputes only after the roster changed.
    const runB = runTierRoleSync([M1], {
      ...common,
      adapter: adapterA,
      loadDiscordUserId: async () => {
        await bMayRead;
        return U1;
      },
      loadMemberships: async () => [fact(roster)],
    });

    await Promise.all([runA, runB]);
    expect(guild.rolesOf(U1)).toEqual([JV]);
  });

  it('a stale run that finishes last wins (the documented flap), and one more resync repairs it', async () => {
    const guild = createFakeGuild({ roles: guildRoles(), botRoleIds: [BOT_ROLE], members: { [U1]: [] } });
    let roster = 'Varsity';
    const adapter = new DiscordRestAdapter({ botToken: 'tok', guildId: GUILD, fetchImpl: guild.fetchImpl, sleep: async () => {}, now: () => clock });
    let releaseStale!: () => void;
    const hold = new Promise<void>((r) => (releaseStale = r));
    let staleHasRead!: () => void;
    const read = new Promise<void>((r) => (staleHasRead = r));
    const base = { roles: ROLES, managed: MANAGED, adapter, loadDiscordUserId: async () => U1, log: () => {} };

    // The stale run read Varsity, then stalls before its Discord write.
    const stale = runTierRoleSync([M1], {
      ...base,
      loadMemberships: async () => {
        const seen = [fact(roster)];
        staleHasRead();
        await hold;
        return seen;
      },
    });
    await read;
    roster = 'JV';
    await runTierRoleSync([M1], { ...base, loadMemberships: async () => [fact(roster)] });
    expect(guild.rolesOf(U1)).toEqual([JV]);
    releaseStale();
    await stale;
    expect(guild.rolesOf(U1)).toEqual([VARSITY]); // last writer won with old data

    await runTierRoleSync([M1], { ...base, loadMemberships: async () => [fact(roster)] });
    expect(guild.rolesOf(U1)).toEqual([JV]); // idempotent repair path: resync again
  });
});
