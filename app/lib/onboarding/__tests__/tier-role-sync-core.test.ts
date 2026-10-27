import { describe, expect, it, vi } from 'vitest';
import { DiscordError, discordFailure, planRoleChanges } from '../adapters/discord-rest';
import type { RoleSyncInput, RoleSyncOutcome } from '../core/ports/external-ports';
import { previewTierSync, runTierRoleSync, type TierSyncDeps } from '../tier-role-sync-core';
import type { RosterMembershipFact, TierRoleMap } from '../tier-roles';

const VAL_V = '111111111111111111';
const VAL_J = '222222222222222222';
const STAFF_ROLE = '999999999999999999';
const ROLES: TierRoleMap = { valorant: { varsity: VAL_V, jv: VAL_J } };
const MANAGED = [VAL_V, VAL_J];

const D = (n: number) => String(100000000000000000n + BigInt(n));
const fact = (rosterName: string, over: Partial<RosterMembershipFact> = {}): RosterMembershipFact => ({
  gameSlug: 'valorant', rosterName, seasonIsActive: true, playerRole: 'player', ...over,
});

const OK = { checkTierRolesAssignable: async () => ({ ok: true as const }) };

/** A fake guild that applies the real planning rules and counts concurrency. */
function fakeGuild(initial: Record<string, string[] | null>) {
  const state = new Map(Object.entries(initial));
  const log: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const adapter = {
    ...OK,
    async syncManagedRoles(discordUserId: string, input: RoleSyncInput): Promise<RoleSyncOutcome> {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      try {
        log.push(`sync ${discordUserId}`);
        const current = state.get(discordUserId);
        if (current === undefined || current === null) return { inGuild: false, added: [], removed: [] };
        const { toAdd, toRemove } = planRoleChanges(current, input);
        state.set(discordUserId, [...current.filter((r) => !toRemove.includes(r)), ...toAdd]);
        return { inGuild: true, added: toAdd, removed: toRemove };
      } finally {
        inFlight--;
      }
    },
  };
  return { adapter, state, log, maxInFlight: () => maxInFlight };
}

function deps(
  members: Record<string, { discord: string | null; memberships: RosterMembershipFact[] }>,
  adapter: TierSyncDeps['adapter'],
  over: Partial<TierSyncDeps> = {}
): TierSyncDeps {
  return {
    roles: ROLES,
    managed: MANAGED,
    loadDiscordUserId: async (id) => members[id]?.discord ?? null,
    loadMemberships: async (id) => members[id]?.memberships ?? [],
    adapter,
    log: () => {},
    ...over,
  };
}

const M1 = '00000001-0000-0000-0000-000000000000';
const M2 = '00000002-0000-0000-0000-000000000000';
const M3 = '00000003-0000-0000-0000-000000000000';

describe('runTierRoleSync', () => {
  it('moves a player Varsity -> JV and never removes a role staff assigned', async () => {
    const g = fakeGuild({ [D(1)]: [VAL_V, STAFF_ROLE] });
    const report = await runTierRoleSync([M1], deps({ [M1]: { discord: D(1), memberships: [fact('JV')] } }, g.adapter));
    expect(report).toMatchObject({ status: 'ok', synced: 1, unchanged: 0, failed: 0 });
    expect(new Set(g.state.get(D(1)))).toEqual(new Set([VAL_J, STAFF_ROLE]));
  });

  it('strips tier roles from a member removed from every roster, keeping unmanaged roles', async () => {
    const g = fakeGuild({ [D(1)]: [VAL_J, STAFF_ROLE] });
    await runTierRoleSync([M1], deps({ [M1]: { discord: D(1), memberships: [] } }, g.adapter));
    expect(g.state.get(D(1))).toEqual([STAFF_ROLE]);
  });

  it('ignores past-season rosters', async () => {
    const g = fakeGuild({ [D(1)]: [] });
    await runTierRoleSync([M1], deps({ [M1]: { discord: D(1), memberships: [fact('Varsity', { seasonIsActive: false })] } }, g.adapter));
    expect(g.state.get(D(1))).toEqual([]);
  });

  it('counts members with no Discord identity (or an invalid id) and never calls Discord for them', async () => {
    const g = fakeGuild({});
    const report = await runTierRoleSync(
      [M1, M2],
      deps({ [M1]: { discord: null, memberships: [fact('Varsity')] }, [M2]: { discord: 'not-a-snowflake', memberships: [fact('Varsity')] } }, g.adapter)
    );
    expect(report.skippedNoDiscord).toBe(2);
    expect(g.log).toEqual([]);
  });

  it('does not read memberships for a member without Discord', async () => {
    const g = fakeGuild({});
    const loadMemberships = vi.fn(async () => []);
    await runTierRoleSync([M1], deps({ [M1]: { discord: null, memberships: [] } }, g.adapter, { loadMemberships }));
    expect(loadMemberships).not.toHaveBeenCalled();
  });

  it('counts a member who is not in the guild', async () => {
    const g = fakeGuild({ [D(1)]: null });
    const report = await runTierRoleSync([M1], deps({ [M1]: { discord: D(1), memberships: [fact('Varsity')] } }, g.adapter));
    expect(report.notInGuild).toBe(1);
  });

  it('isolates failures per member and reports only masked ids and codes', async () => {
    const g = fakeGuild({ [D(1)]: [], [D(3)]: [] });
    const failing = {
      ...OK,
      async syncManagedRoles(id: string, input: RoleSyncInput) {
        if (id === D(2)) throw discordFailure('outage');
        return g.adapter.syncManagedRoles(id, input);
      },
    };
    const lines: string[] = [];
    const report = await runTierRoleSync(
      [M1, M2, M3],
      deps(
        {
          [M1]: { discord: D(1), memberships: [fact('Varsity')] },
          [M2]: { discord: D(2), memberships: [fact('Varsity')] },
          [M3]: { discord: D(3), memberships: [fact('JV')] },
        },
        failing,
        { log: (l) => lines.push(l) }
      )
    );
    expect(report).toMatchObject({ synced: 2, failed: 1 });
    expect(report.failures).toEqual([{ member: '00000002...', memberId: M2, reason: 'outage' }]);
    expect(g.state.get(D(3))).toEqual([VAL_J]);
    const text = lines.join('\n');
    expect(text).toContain('00000002...');
    expect(text).not.toContain(D(2));
    expect(text).not.toContain(M2);
  });

  it('an unexpected error is logged by class name only (database errors can embed query values)', async () => {
    const lines: string[] = [];
    const report = await runTierRoleSync(
      [M1],
      deps({}, fakeGuild({}).adapter, {
        loadDiscordUserId: async () => {
          throw new Error('Failed query: select ... params: secret-member-data');
        },
        log: (l) => lines.push(l),
      })
    );
    expect(report.failures[0].reason).toBe('unexpected_error');
    expect(lines.join('')).not.toContain('secret-member-data');
  });

  it('is idempotent: a second run changes nothing', async () => {
    const g = fakeGuild({ [D(1)]: [VAL_V, STAFF_ROLE] });
    const d = deps({ [M1]: { discord: D(1), memberships: [fact('JV')] } }, g.adapter);
    await runTierRoleSync([M1], d);
    const after = [...(g.state.get(D(1)) ?? [])];
    const second = await runTierRoleSync([M1], d);
    expect(second).toMatchObject({ synced: 0, unchanged: 1 });
    expect(g.state.get(D(1))).toEqual(after);
  });

  it('processes members strictly one at a time, reading the database one query at a time too', async () => {
    const g = fakeGuild({ [D(1)]: [], [D(2)]: [], [D(3)]: [] });
    let dbInFlight = 0;
    let dbMax = 0;
    const dbCall = async <T,>(v: T): Promise<T> => {
      dbInFlight++;
      dbMax = Math.max(dbMax, dbInFlight);
      await new Promise((r) => setTimeout(r, 1));
      dbInFlight--;
      return v;
    };
    await runTierRoleSync(
      [M1, M2, M3],
      deps({}, g.adapter, {
        loadDiscordUserId: (id) => dbCall(id === M1 ? D(1) : id === M2 ? D(2) : D(3)),
        loadMemberships: () => dbCall([fact('Varsity')]),
      })
    );
    expect(g.maxInFlight()).toBe(1);
    expect(dbMax).toBe(1);
    expect(g.log).toEqual([`sync ${D(1)}`, `sync ${D(2)}`, `sync ${D(3)}`]);
  });

  it('de-duplicates member ids', async () => {
    const g = fakeGuild({ [D(1)]: [] });
    await runTierRoleSync([M1, M1, M1], deps({ [M1]: { discord: D(1), memberships: [fact('Varsity')] } }, g.adapter));
    expect(g.log).toEqual([`sync ${D(1)}`]);
  });

  it('paces between members using the injected sleep', async () => {
    const g = fakeGuild({ [D(1)]: [], [D(2)]: [] });
    const sleep = vi.fn(async () => {});
    await runTierRoleSync(
      [M1, M2],
      deps({ [M1]: { discord: D(1), memberships: [] }, [M2]: { discord: D(2), memberships: [] } }, g.adapter, { paceMs: 50, sleep })
    );
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it('does not pause for members without a Discord account (no Discord call, no pacing)', async () => {
    const g = fakeGuild({ [D(3)]: [] });
    const sleep = vi.fn(async () => {});
    await runTierRoleSync(
      [M1, M2, M3],
      deps({ [M1]: { discord: null, memberships: [] }, [M2]: { discord: null, memberships: [] }, [M3]: { discord: D(3), memberships: [fact('Varsity')] } }, g.adapter, { paceMs: 50, sleep })
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it('is blocked without touching any member when the preflight fails', async () => {
    const loadDiscordUserId = vi.fn(async () => D(1));
    const adapter = { checkTierRolesAssignable: async () => ({ ok: false as const, reason: 'missing_manage_roles' as const }), syncManagedRoles: vi.fn() };
    const report = await runTierRoleSync([M1], deps({}, adapter, { loadDiscordUserId }));
    expect(report).toMatchObject({ status: 'blocked', blockedReason: 'missing_manage_roles' });
    expect(adapter.syncManagedRoles).not.toHaveBeenCalled();
    expect(loadDiscordUserId).not.toHaveBeenCalled();
  });

  it('stops after a bot_misconfigured failure and reports the rest as not attempted', async () => {
    const adapter = { ...OK, syncManagedRoles: vi.fn(async () => { throw discordFailure('bot_misconfigured'); }) };
    const report = await runTierRoleSync(
      [M1, M2],
      deps(Object.fromEntries([M1, M2].map((m, i) => [m, { discord: D(i + 1), memberships: [fact('Varsity')] }])), adapter)
    );
    expect(adapter.syncManagedRoles).toHaveBeenCalledTimes(1);
    expect(report.failures.map((f) => f.reason)).toEqual(['bot_misconfigured', 'not_attempted_after_config_error']);
  });

  it('stops hammering Discord after a rate limit and reports the rest as not attempted', async () => {
    const adapter = {
      ...OK,
      syncManagedRoles: vi.fn(async () => {
        throw new DiscordError('rate_limited', 'x', 2);
      }),
    };
    const report = await runTierRoleSync(
      [M1, M2, M3],
      deps(
        Object.fromEntries([M1, M2, M3].map((m, i) => [m, { discord: D(i + 1), memberships: [fact('Varsity')] }])),
        adapter
      )
    );
    expect(adapter.syncManagedRoles).toHaveBeenCalledTimes(1);
    expect(report.failed).toBe(3);
    expect(report.failures.map((f) => f.reason)).toEqual(['rate_limited', 'not_attempted_after_rate_limit', 'not_attempted_after_rate_limit']);
  });

  it('only ever passes the managed set to the adapter', async () => {
    const adapter = { ...OK, syncManagedRoles: vi.fn(async () => ({ inGuild: true, added: [], removed: [] })) };
    await runTierRoleSync([M1], deps({ [M1]: { discord: D(1), memberships: [fact('Varsity')] } }, adapter));
    expect(adapter.syncManagedRoles).toHaveBeenCalledWith(D(1), { managed: MANAGED, desired: [VAL_V] });
  });
});

describe('previewTierSync', () => {
  const run = (members: Record<string, { discord: string | null; memberships: RosterMembershipFact[] }>) =>
    previewTierSync(Object.keys(members), {
      roles: ROLES,
      loadDiscordUserId: async (id) => members[id].discord,
      loadMemberships: async (id) => members[id].memberships,
    });

  it('flags a school where nobody connected would hold a tier role (an empty new season)', async () => {
    const p = await run({
      [M1]: { discord: D(1), memberships: [fact('Varsity', { seasonIsActive: false })] },
      [M2]: { discord: D(2), memberships: [] },
      [M3]: { discord: null, memberships: [fact('Varsity')] },
    });
    expect(p).toEqual({ members: 3, withDiscord: 2, withTierRoles: 0, stripAll: true });
  });
  it('does not flag when at least one connected member keeps a tier role', async () => {
    const p = await run({ [M1]: { discord: D(1), memberships: [fact('JV')] }, [M2]: { discord: D(2), memberships: [] } });
    expect(p).toMatchObject({ withDiscord: 2, withTierRoles: 1, stripAll: false });
  });
  it('does not flag a school with nobody connected (nothing to strip)', async () => {
    expect((await run({ [M1]: { discord: null, memberships: [] } })).stripAll).toBe(false);
  });
});
