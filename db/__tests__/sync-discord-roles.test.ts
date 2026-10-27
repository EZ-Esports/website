import { describe, expect, it, vi } from 'vitest';
import { DiscordError } from '../../app/lib/onboarding/adapters/discord-rest';
import { planRoleChanges } from '../../app/lib/onboarding/adapters/discord-rest';
import {
  confirmationPhrase,
  loadMembersFrom,
  maskDiscord,
  maskName,
  parseArgs,
  runRoleSync,
  type ScriptMember,
  type SqlLike,
  type SyncScriptDeps,
} from '../sync-discord-roles';

const VAL_V = '111111111111111111';
const VAL_J = '222222222222222222';
const STAFF = '999999999999999999';
const ROLES = { valorant: { varsity: VAL_V, jv: VAL_J } };

const member = (n: number, rosterName: string, first = 'Alexandra', last = 'Fernandez'): ScriptMember => ({
  id: `${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-dddddddddddd`,
  firstName: first,
  lastName: last,
  discordUserId: String(100000000000000000n + BigInt(n)),
  memberships: [{ gameSlug: 'valorant', rosterName, seasonIsActive: true, playerRole: 'player' }],
});

function harness(members: ScriptMember[], current: Record<string, string[] | null>, over: Partial<SyncScriptDeps> = {}) {
  const lines: string[] = [];
  const writes: string[] = [];
  const getMemberRoles = vi.fn(async (id: string) => current[id] ?? null);
  const syncManagedRoles = vi.fn(async (id: string, input: { managed: string[]; desired: string[] }) => {
    const cur = current[id];
    if (!cur) return { inGuild: false, added: [], removed: [] };
    const { toAdd, toRemove } = planRoleChanges(cur, input);
    writes.push(`${id}:+${toAdd.length}-${toRemove.length}`);
    return { inGuild: true, added: toAdd, removed: toRemove };
  });
  const deps: SyncScriptDeps = {
    host: 'db.example.com',
    roles: ROLES,
    managed: [VAL_V, VAL_J],
    assertTarget: vi.fn(),
    loadMembers: async () => members,
    adapter: { getMemberRoles, syncManagedRoles },
    prompt: vi.fn(async () => ''),
    sleep: vi.fn(async () => {}),
    log: (l) => lines.push(l),
    ...over,
  };
  return { deps, lines, writes, getMemberRoles, syncManagedRoles };
}

describe('parseArgs', () => {
  it('defaults to a dry run', () => {
    expect(parseArgs([])).toEqual({ execute: false, noDiscordRead: false });
    expect(parseArgs(['--dry-run'])).toEqual({ execute: false, noDiscordRead: false });
    expect(parseArgs(['--no-discord-read'])).toEqual({ execute: false, noDiscordRead: true });
    expect(parseArgs(['--execute'])).toEqual({ execute: true, noDiscordRead: false });
  });
  it('rejects contradictions and unknown flags', () => {
    expect(() => parseArgs(['--execute', '--dry-run'])).toThrow('mutually exclusive');
    expect(() => parseArgs(['--execute', '--no-discord-read'])).toThrow('only valid for a dry run');
    expect(() => parseArgs(['--yolo'])).toThrow('Unknown argument');
  });
});

describe('dry run', () => {
  it('reads Discord and prints the diff, with zero writes and no confirmation prompt', async () => {
    const m1 = member(1, 'JV');
    const m2 = member(2, 'Varsity');
    const h = harness([m1, m2], { [m1.discordUserId]: [VAL_V, STAFF], [m2.discordUserId]: [VAL_V] });
    const result = await runRoleSync({ execute: false, noDiscordRead: false }, h.deps);
    expect(h.syncManagedRoles).not.toHaveBeenCalled();
    expect(h.deps.prompt).not.toHaveBeenCalled();
    expect(h.deps.assertTarget).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mode: 'dry-run', toChange: 1, inSync: 1, adds: 1, removes: 1, exitCode: 0 });
    expect(h.lines.join('\n')).toContain('add [valorant/jv] remove [valorant/varsity]');
    expect(h.lines.join('\n')).toContain('0 mutations executed');
  });

  it('prints only masked identifiers: initials and truncated ids', async () => {
    const m1 = member(1, 'JV');
    const h = harness([m1], { [m1.discordUserId]: [] });
    await runRoleSync({ execute: false, noDiscordRead: false }, h.deps);
    const out = h.lines.join('\n');
    expect(out).toContain('A. F.');
    expect(out).toContain(maskDiscord(m1.discordUserId));
    expect(out).not.toContain('Alexandra');
    expect(out).not.toContain('Fernandez');
    expect(out).not.toContain(m1.discordUserId);
    expect(out).not.toContain(m1.id);
  });

  it('--no-discord-read lists desired roles and makes no Discord call', async () => {
    const m1 = member(1, 'Varsity');
    const h = harness([m1], {});
    await runRoleSync({ execute: false, noDiscordRead: true }, { ...h.deps, adapter: null });
    expect(h.getMemberRoles).not.toHaveBeenCalled();
    expect(h.lines.join('\n')).toContain('desired=[valorant/varsity]');
  });

  it('reading Discord without a bot is a clear refusal', async () => {
    const h = harness([], {}, { adapter: null });
    await expect(runRoleSync({ execute: false, noDiscordRead: false }, h.deps)).rejects.toThrow('--no-discord-read');
  });

  it('counts members not in the server and unreadable members without aborting', async () => {
    const [a, b, c] = [member(1, 'JV'), member(2, 'JV'), member(3, 'JV')];
    const h = harness([a, b, c], { [a.discordUserId]: null, [c.discordUserId]: [] });
    h.getMemberRoles.mockImplementation(async (id: string) => {
      if (id === b.discordUserId) throw new DiscordError('outage', 'x');
      return id === a.discordUserId ? null : [];
    });
    const r = await runRoleSync({ execute: false, noDiscordRead: false }, h.deps);
    expect(r).toMatchObject({ notInGuild: 1, readFailed: 1, toChange: 1 });
  });

  it('reads Discord strictly one member at a time', async () => {
    let inFlight = 0;
    let max = 0;
    const ms = [member(1, 'JV'), member(2, 'JV'), member(3, 'JV')];
    const h = harness(ms, {});
    h.getMemberRoles.mockImplementation(async () => {
      inFlight++;
      max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return [];
    });
    await runRoleSync({ execute: false, noDiscordRead: false }, { ...h.deps, paceMs: 5 });
    expect(max).toBe(1);
    expect(h.deps.sleep).toHaveBeenCalledWith(5);
  });

  it('waits out a 429 and retries the read', async () => {
    const m1 = member(1, 'JV');
    const h = harness([m1], {});
    let n = 0;
    h.getMemberRoles.mockImplementation(async () => {
      if (n++ === 0) throw new DiscordError('rate_limited', 'x', 2);
      return [];
    });
    const r = await runRoleSync({ execute: false, noDiscordRead: false }, h.deps);
    expect(h.deps.sleep).toHaveBeenCalledWith(2000);
    expect(r.toChange).toBe(1);
  });
});

describe('--execute guards', () => {
  it('checks the remote-host gate before reading anything', async () => {
    const h = harness([member(1, 'JV')], {}, {
      assertTarget: () => {
        throw new Error('not allowed');
      },
    });
    const load = vi.spyOn(h.deps, 'loadMembers');
    await expect(runRoleSync({ execute: true, noDiscordRead: false }, h.deps)).rejects.toThrow('not allowed');
    expect(load).not.toHaveBeenCalled();
    expect(h.syncManagedRoles).not.toHaveBeenCalled();
  });

  it('requires the exact typed phrase; anything else aborts with zero writes', async () => {
    const m1 = member(1, 'JV');
    const h = harness([m1], { [m1.discordUserId]: [VAL_V] }, { prompt: vi.fn(async () => 'yes') });
    await expect(runRoleSync({ execute: true, noDiscordRead: false }, h.deps)).rejects.toThrow('Confirmation did not match');
    expect(h.syncManagedRoles).not.toHaveBeenCalled();
  });

  it('applies the diff after the right phrase, touching only managed roles', async () => {
    const m1 = member(1, 'JV');
    const cur = { [m1.discordUserId]: [VAL_V, STAFF] };
    const phrase = confirmationPhrase('db.example.com', 1, 1, 1);
    const h = harness([m1], cur, { prompt: vi.fn(async () => phrase) });
    const r = await runRoleSync({ execute: true, noDiscordRead: false }, h.deps);
    expect(phrase).toBe('sync-roles db.example.com 1 1 1');
    expect(h.deps.assertTarget).toHaveBeenCalled();
    expect(h.syncManagedRoles).toHaveBeenCalledWith(m1.discordUserId, { managed: [VAL_V, VAL_J], desired: [VAL_J] });
    expect(r).toMatchObject({ applied: 1, applyFailed: 0, exitCode: 0 });
  });

  it('exits 2 when some students fail to apply, and keeps going', async () => {
    const [a, b] = [member(1, 'JV'), member(2, 'JV')];
    const cur = { [a.discordUserId]: [], [b.discordUserId]: [] };
    const phrase = confirmationPhrase('db.example.com', 2, 2, 0);
    const h = harness([a, b], cur, { prompt: vi.fn(async () => phrase) });
    h.syncManagedRoles.mockRejectedValueOnce(new DiscordError('bot_misconfigured', 'x'));
    const r = await runRoleSync({ execute: true, noDiscordRead: false }, h.deps);
    expect(r).toMatchObject({ applied: 1, applyFailed: 1, exitCode: 2 });
    expect(h.lines.join('\n')).toContain('FAILED');
  });

  it('does not prompt or write when everything is already in sync', async () => {
    const m1 = member(1, 'JV');
    const h = harness([m1], { [m1.discordUserId]: [VAL_J] });
    const r = await runRoleSync({ execute: true, noDiscordRead: false }, h.deps);
    expect(h.deps.prompt).not.toHaveBeenCalled();
    expect(r.applied).toBe(0);
  });
});

describe('loadMembersFrom', () => {
  it('runs its queries strictly one at a time and keeps the freshest valid snowflake', async () => {
    let inFlight = 0;
    let max = 0;
    let calls = 0;
    const sql: SqlLike = {
      unsafe: async (q) => {
        calls++;
        inFlight++;
        max = Math.max(max, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        if (q.includes('player_identities')) {
          return [
            { member_id: 'm1', provider_user_id: 'garbage', first_name: 'A', last_name: 'B' },
            { member_id: 'm1', provider_user_id: '123456789012345678', first_name: 'A', last_name: 'B' },
            { member_id: 'm2', provider_user_id: 'garbage', first_name: 'C', last_name: 'D' },
          ];
        }
        return [{ member_id: 'm1', game_slug: 'valorant', roster_name: 'JV', is_active: true, role: 'sub' }];
      },
    };
    const members = await loadMembersFrom(sql);
    expect(max).toBe(1);
    expect(calls).toBe(2);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: 'm1', discordUserId: '123456789012345678' });
    expect(members[0].memberships).toEqual([{ gameSlug: 'valorant', rosterName: 'JV', seasonIsActive: true, playerRole: 'sub' }]);
  });
});

describe('masking helpers', () => {
  it('never reveals a full name or id', () => {
    expect(maskName('Alexandra', 'Fernandez')).toBe('A. F.');
    expect(maskDiscord('123456789012345678')).toBe('1234...78');
  });
});
