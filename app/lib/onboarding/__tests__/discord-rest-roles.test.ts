import { describe, expect, it, vi } from 'vitest';
import { DiscordError, DiscordRestAdapter, ROLE_SYNC_AUDIT_REASON, planRoleChanges } from '../adapters/discord-rest';

const UID = '123456789012345678';
const R1 = '111111111111111111';
const R2 = '222222222222222222';
const R3 = '333333333333333333'; // a role staff assigned by hand: not managed
const MANAGED = [R1, R2];

const res = (status: number, body: unknown = null, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers });

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function setup(handler: Handler) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method), headers: (init.headers ?? {}) as Record<string, string> });
    return handler(url, init);
  });
  const sleep = vi.fn(async (_ms: number) => {});
  const adapter = new DiscordRestAdapter({ botToken: 'tok', guildId: 'g1', fetchImpl: fetchImpl as never, sleep });
  return { adapter, calls, sleep, fetchImpl };
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DiscordError);
    return (e as DiscordError).code;
  }
  throw new Error('expected rejection');
}

describe('planRoleChanges', () => {
  it('adds missing desired roles and removes held managed roles that are no longer desired', () => {
    expect(planRoleChanges([R1, R3], { managed: MANAGED, desired: [R2] })).toEqual({ toAdd: [R2], toRemove: [R1] });
  });
  it('never touches a role outside the managed set, even if it is listed as desired', () => {
    expect(planRoleChanges([R3], { managed: MANAGED, desired: [R3] })).toEqual({ toAdd: [], toRemove: [] });
    expect(planRoleChanges([R3, R1], { managed: MANAGED, desired: [] })).toEqual({ toAdd: [], toRemove: [R1] });
  });
  it('is empty when already correct', () => {
    expect(planRoleChanges([R1, R3], { managed: MANAGED, desired: [R1] })).toEqual({ toAdd: [], toRemove: [] });
  });
});

describe('getMemberRoles', () => {
  it('returns the member role ids on 200', async () => {
    const { adapter, calls } = setup(() => res(200, { roles: [R1, R3, 'junk'] }));
    expect(await adapter.getMemberRoles(UID)).toEqual([R1, R3]);
    expect(calls[0].url).toBe(`https://discord.com/api/v10/guilds/g1/members/${UID}`);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers.Authorization).toBe('Bot tok');
  });
  it('returns null on 404 (not in the guild)', async () => {
    const { adapter } = setup(() => res(404, { code: 10007 }));
    expect(await adapter.getMemberRoles(UID)).toBeNull();
  });
  it('treats an unknown guild (10004) as a misconfiguration, not an absent user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { adapter } = setup(() => res(404, { code: 10004 }));
    expect(await codeOf(adapter.getMemberRoles(UID))).toBe('bot_misconfigured');
  });
  it('maps 403 to bot_misconfigured and 5xx to outage', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await codeOf(setup(() => res(403)).adapter.getMemberRoles(UID))).toBe('bot_misconfigured');
    expect(await codeOf(setup(() => res(503)).adapter.getMemberRoles(UID))).toBe('outage');
  });
  it('rejects an invalid user id without calling Discord', async () => {
    const { adapter, fetchImpl } = setup(() => res(200, { roles: [] }));
    expect(await codeOf(adapter.getMemberRoles('abc'))).toBe('unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('addMemberRole / removeMemberRole', () => {
  it('PUTs and DELETEs the per-role endpoint with the audit-log reason', async () => {
    const { adapter, calls } = setup(() => res(204));
    await adapter.addMemberRole(UID, R1);
    await adapter.removeMemberRole(UID, R1);
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'DELETE']);
    for (const c of calls) {
      expect(c.url).toBe(`https://discord.com/api/v10/guilds/g1/members/${UID}/roles/${R1}`);
      expect(c.headers['X-Audit-Log-Reason']).toBe(ROLE_SYNC_AUDIT_REASON);
      expect(c.headers.Authorization).toBe('Bot tok');
    }
    expect(ROLE_SYNC_AUDIT_REASON).toMatch(/^[\x20-\x7e]+$/);
  });
  it('maps 403 to bot_misconfigured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await codeOf(setup(() => res(403, { code: 50013 })).adapter.addMemberRole(UID, R1))).toBe('bot_misconfigured');
    expect(await codeOf(setup(() => res(401)).adapter.removeMemberRole(UID, R1))).toBe('bot_misconfigured');
  });
  it('maps 404 unknown role to role_not_found and unknown member to member_not_found', async () => {
    expect(await codeOf(setup(() => res(404, { code: 10011 })).adapter.addMemberRole(UID, R1))).toBe('role_not_found');
    expect(await codeOf(setup(() => res(404, { code: 10007 })).adapter.addMemberRole(UID, R1))).toBe('member_not_found');
  });
  it('attributes a 404 by Discord error code: 10004 is a misconfiguration, anything else is unknown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await codeOf(setup(() => res(404, { code: 10004 })).adapter.addMemberRole(UID, R1))).toBe('bot_misconfigured');
    expect(await codeOf(setup(() => res(404, { code: 99999 })).adapter.addMemberRole(UID, R1))).toBe('unknown');
    expect(await codeOf(setup(() => res(404, {})).adapter.removeMemberRole(UID, R1))).toBe('unknown');
    // A proxy or CDN error page is not JSON; it must not be blamed on the role configuration.
    expect(await codeOf(setup(() => new Response('<html>Not Found</html>', { status: 404 })).adapter.addMemberRole(UID, R1))).toBe('unknown');
  });
  it('rejects invalid ids without calling Discord', async () => {
    const { adapter, fetchImpl } = setup(() => res(204));
    expect(await codeOf(adapter.addMemberRole(UID, 'nope'))).toBe('unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('honours a short 429 Retry-After once, then succeeds', async () => {
    let n = 0;
    const { adapter, sleep, calls } = setup(() => (n++ === 0 ? res(429, null, { 'retry-after': '1' }) : res(204)));
    await adapter.addMemberRole(UID, R1);
    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
  it('surfaces a persistent 429 as a retryable rate_limited error', async () => {
    const { adapter, calls } = setup(() => res(429, null, { 'retry-after': '1' }));
    const err = await adapter.addMemberRole(UID, R1).catch((e) => e);
    expect(err).toBeInstanceOf(DiscordError);
    expect(err.code).toBe('rate_limited');
    expect(calls).toHaveLength(2);
  });
  it('does not wait out a long Retry-After', async () => {
    const { adapter, sleep, calls } = setup(() => res(429, null, { 'retry-after': '60' }));
    expect(await codeOf(adapter.addMemberRole(UID, R1))).toBe('rate_limited');
    expect(sleep).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});

describe('syncManagedRoles', () => {
  function guild(initial: string[]) {
    let roles = [...initial];
    return setup((url, init) => {
      if (init.method === 'GET') return res(200, { roles });
      const id = url.split('/').pop()!;
      roles = init.method === 'PUT' ? [...new Set([...roles, id])] : roles.filter((r) => r !== id);
      return res(204);
    });
  }

  it('moves Varsity -> JV: adds JV, removes Varsity, leaves the staff-assigned role alone', async () => {
    const { adapter, calls } = guild([R1, R3]);
    const out = await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R2] });
    expect(out).toEqual({ inGuild: true, added: [R2], removed: [R1] });
    const writes = calls.filter((c) => c.method !== 'GET');
    expect(writes.map((c) => `${c.method} ${c.url.split('/').pop()}`)).toEqual([`PUT ${R2}`, `DELETE ${R1}`]);
    expect(writes.some((c) => c.url.endsWith(R3))).toBe(false);
  });

  it('is idempotent: a second run performs no write', async () => {
    const { adapter, calls } = guild([R1, R3]);
    await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R2] });
    calls.length = 0;
    const out = await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R2] });
    expect(out).toEqual({ inGuild: true, added: [], removed: [] });
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('removes all managed roles when nothing is desired, still not the unmanaged one', async () => {
    const { adapter, calls } = guild([R1, R2, R3]);
    const out = await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [] });
    expect(out.removed.sort()).toEqual([R1, R2]);
    expect(calls.some((c) => c.url.endsWith(R3))).toBe(false);
  });

  it('refuses to add a desired role that is not managed', async () => {
    const { adapter, calls } = guild([]);
    const out = await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R3] });
    expect(out).toEqual({ inGuild: true, added: [], removed: [] });
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('reports not-in-guild without writing', async () => {
    const { adapter, calls } = setup(() => res(404, { code: 10007 }));
    expect(await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R1] })).toEqual({ inGuild: false, added: [], removed: [] });
    expect(calls).toHaveLength(1);
  });

  it('treats a member who left between the read and the write as not in the guild', async () => {
    const { adapter } = setup((_u, init) => (init.method === 'GET' ? res(200, { roles: [] }) : res(404, { code: 10007 })));
    expect(await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R1] })).toEqual({ inGuild: false, added: [], removed: [] });
  });

  it('propagates a missing role as role_not_found', async () => {
    const { adapter } = setup((_u, init) => (init.method === 'GET' ? res(200, { roles: [] }) : res(404, { code: 10011 })));
    expect(await codeOf(adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R1] }))).toBe('role_not_found');
  });

  it('never sends PATCH, and never a body that overwrites the roles array', async () => {
    const { adapter, fetchImpl } = guild([R1, R3]);
    await adapter.syncManagedRoles(UID, { managed: MANAGED, desired: [R2] });
    for (const [, init] of fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(init.method).not.toBe('PATCH');
      expect(init.body ?? null).toBeNull();
    }
  });
});
