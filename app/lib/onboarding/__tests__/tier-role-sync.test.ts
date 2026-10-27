import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The DB module is mocked so importing the service never builds a real client.
vi.mock('@/app/lib/db', () => ({ db: {} }));

const adapterCalls = vi.hoisted(() => ({ ctor: 0, sync: 0 }));
vi.mock('../adapters/discord-rest', async (orig) => {
  const actual = await orig<typeof import('../adapters/discord-rest')>();
  class FakeAdapter {
    constructor() {
      adapterCalls.ctor++;
    }
    async syncManagedRoles() {
      adapterCalls.sync++;
      return { inGuild: true, added: [], removed: [] };
    }
  }
  return { ...actual, DiscordRestAdapter: FakeAdapter };
});

import { syncTierRolesForMembers } from '../tier-role-sync';
import { resetTierRoleConfigLog } from '../tier-roles';

const ENV_KEYS = ['DISCORD_TIER_ROLES', 'DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  adapterCalls.ctor = 0;
  adapterCalls.sync = 0;
  resetTierRoleConfigLog();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe('syncTierRolesForMembers entry point', () => {
  it('is a safe no-op with zero adapter use when DISCORD_TIER_ROLES is unset', async () => {
    process.env.DISCORD_BOT_TOKEN = 't';
    process.env.DISCORD_GUILD_ID = 'g';
    const report = await syncTierRolesForMembers(['m1']);
    expect(report).toMatchObject({ status: 'disabled', disabledReason: 'config_unset' });
    expect(adapterCalls).toEqual({ ctor: 0, sync: 0 });
  });

  it('is disabled (not a crash) for a malformed config, and says so in the log', async () => {
    process.env.DISCORD_TIER_ROLES = '{bad';
    process.env.DISCORD_BOT_TOKEN = 't';
    process.env.DISCORD_GUILD_ID = 'g';
    const report = await syncTierRolesForMembers(['m1']);
    expect(report).toMatchObject({ status: 'disabled', disabledReason: 'config_invalid' });
    expect(adapterCalls).toEqual({ ctor: 0, sync: 0 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DISABLED'));
  });

  it('skips silently when the bot env is missing', async () => {
    process.env.DISCORD_TIER_ROLES = JSON.stringify({ valorant: { varsity: '111111111111111111' } });
    const report = await syncTierRolesForMembers(['m1']);
    expect(report).toMatchObject({ status: 'disabled', disabledReason: 'discord_unconfigured' });
    expect(adapterCalls.ctor).toBe(0);
  });

  it('returns an empty ok report for no members without touching Discord', async () => {
    process.env.DISCORD_TIER_ROLES = JSON.stringify({ valorant: { varsity: '111111111111111111' } });
    process.env.DISCORD_BOT_TOKEN = 't';
    process.env.DISCORD_GUILD_ID = 'g';
    expect(await syncTierRolesForMembers([])).toMatchObject({ status: 'ok', synced: 0, failed: 0 });
    expect(adapterCalls.sync).toBe(0);
  });

  it('never throws: a failing database is reported as failed members', async () => {
    process.env.DISCORD_TIER_ROLES = JSON.stringify({ valorant: { varsity: '111111111111111111' } });
    process.env.DISCORD_BOT_TOKEN = 't';
    process.env.DISCORD_GUILD_ID = 'g';
    // db is `{}`, so the first query throws inside the per-member isolation.
    const report = await syncTierRolesForMembers(['00000001-0000-0000-0000-000000000000']);
    expect(report.status).toBe('ok');
    expect(report.failed).toBe(1);
    expect(report.failures[0].reason).toBe('unexpected_error');
  });
});
