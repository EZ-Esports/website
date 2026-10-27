import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  desiredRoleIds,
  getTierRoleConfig,
  parseTierRoles,
  resetTierRoleConfigLog,
  tierOfRosterName,
  type RosterMembershipFact,
  type TierRoleMap,
} from '../tier-roles';

const VAL_V = '111111111111111111';
const VAL_J = '222222222222222222';
const LOL_V = '333333333333333333';
const LOL_J = '444444444444444444';

const CONFIG: TierRoleMap = {
  valorant: { varsity: VAL_V, jv: VAL_J },
  'league-of-legends': { varsity: LOL_V, jv: LOL_J },
};

const fact = (over: Partial<RosterMembershipFact> = {}): RosterMembershipFact => ({
  gameSlug: 'valorant',
  rosterName: 'Varsity',
  seasonIsActive: true,
  playerRole: 'player',
  ...over,
});

describe('parseTierRoles', () => {
  it('parses a valid config and lists exactly the configured ids as managed', () => {
    const c = parseTierRoles(JSON.stringify(CONFIG));
    expect(c.status).toBe('enabled');
    if (c.status !== 'enabled') return;
    expect(c.roles).toEqual(CONFIG);
    expect([...c.managed].sort()).toEqual([VAL_V, VAL_J, LOL_V, LOL_J].sort());
  });

  it('allows a game that configures only one tier', () => {
    const c = parseTierRoles(JSON.stringify({ valorant: { varsity: VAL_V } }));
    expect(c.status).toBe('enabled');
  });

  it.each([undefined, '', '   ', '{}'])('treats %j as disabled (not an error)', (raw) => {
    expect(parseTierRoles(raw)).toEqual({ status: 'disabled', reason: 'unset' });
  });

  it.each([
    ['not json', 'not valid JSON'],
    ['[]', 'JSON object'],
    ['"x"', 'JSON object'],
    ['null', 'JSON object'],
    [JSON.stringify({ valorant: 'x' }), 'must be an object'],
    [JSON.stringify({ valorant: {} }), 'no tiers'],
    [JSON.stringify({ Valorant: { varsity: VAL_V } }), 'not a valid game slug'],
    [JSON.stringify({ valorant: { gold: VAL_V } }), 'unknown tier'],
    [JSON.stringify({ valorant: { varsity: '123' } }), 'valid Discord role id'],
    [JSON.stringify({ valorant: { varsity: 12345678901234567 } }), 'valid Discord role id'],
  ])('flags malformed config %j', (raw, fragment) => {
    const c = parseTierRoles(raw);
    expect(c.status).toBe('invalid');
    if (c.status === 'invalid') expect(c.errors.join(' ')).toContain(fragment);
  });

  it('rejects a role id reused across games or tiers', () => {
    const across = parseTierRoles(JSON.stringify({ valorant: { varsity: VAL_V }, osu: { varsity: VAL_V } }));
    expect(across.status).toBe('invalid');
    const within = parseTierRoles(JSON.stringify({ valorant: { varsity: VAL_V, jv: VAL_V } }));
    expect(within.status).toBe('invalid');
    if (within.status === 'invalid') expect(within.errors.join(' ')).toContain('already used');
  });

  it('one bad entry disables the whole sync rather than half-applying it', () => {
    const c = parseTierRoles(JSON.stringify({ valorant: { varsity: VAL_V }, osu: { varsity: 'bad' } }));
    expect(c.status).toBe('invalid');
  });
});

describe('getTierRoleConfig logging', () => {
  afterEach(() => {
    resetTierRoleConfigLog();
    vi.restoreAllMocks();
  });

  it('logs a disabled or invalid state once, never throws', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    getTierRoleConfig({} as NodeJS.ProcessEnv);
    getTierRoleConfig({} as NodeJS.ProcessEnv);
    expect(info).toHaveBeenCalledTimes(1);
    expect(getTierRoleConfig({ DISCORD_TIER_ROLES: '{oops' } as unknown as NodeJS.ProcessEnv).status).toBe('invalid');
    getTierRoleConfig({ DISCORD_TIER_ROLES: '{oops' } as unknown as NodeJS.ProcessEnv);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toContain('DISABLED');
  });
});

describe('tierOfRosterName', () => {
  it.each([
    ['Varsity', 'varsity'],
    ['varsity', 'varsity'],
    ['  VARSITY ', 'varsity'],
    ['JV', 'jv'],
    ['jv', 'jv'],
    ['Junior Varsity', 'jv'],
    ['junior   varsity', 'jv'],
  ])('%j -> %s', (name, tier) => {
    expect(tierOfRosterName(name)).toBe(tier);
  });

  it.each(['Academy', 'Varsity 2', 'JV Red', '', 'Varsity-A', 'Main'])('%j grants nothing', (name) => {
    expect(tierOfRosterName(name)).toBeNull();
  });
});

describe('desiredRoleIds', () => {
  it('gives the tier role of the roster the player is on', () => {
    expect(desiredRoleIds([fact()], CONFIG)).toEqual([VAL_V]);
    expect(desiredRoleIds([fact({ rosterName: 'JV' })], CONFIG)).toEqual([VAL_J]);
  });

  it('a Varsity -> JV move swaps the role (only the JV role remains desired)', () => {
    const before = desiredRoleIds([fact({ rosterName: 'Varsity' })], CONFIG);
    const after = desiredRoleIds([fact({ rosterName: 'JV' })], CONFIG);
    expect(before).toEqual([VAL_V]);
    expect(after).toEqual([VAL_J]);
    expect(after).not.toContain(VAL_V);
  });

  it('different games are independent', () => {
    const got = desiredRoleIds(
      [fact({ gameSlug: 'valorant', rosterName: 'Varsity' }), fact({ gameSlug: 'league-of-legends', rosterName: 'JV' })],
      CONFIG
    );
    expect(new Set(got)).toEqual(new Set([VAL_V, LOL_J]));
  });

  it('ignores rosters of an inactive (past) season', () => {
    expect(desiredRoleIds([fact({ seasonIsActive: false })], CONFIG)).toEqual([]);
  });

  it('a past-season Varsity does not stack onto an active JV', () => {
    const got = desiredRoleIds([fact({ seasonIsActive: false, rosterName: 'Varsity' }), fact({ rosterName: 'JV' })], CONFIG);
    expect(got).toEqual([VAL_J]);
  });

  it('an unknown roster name grants nothing', () => {
    expect(desiredRoleIds([fact({ rosterName: 'Academy' })], CONFIG)).toEqual([]);
  });

  it('captains and subs count; coaches do not', () => {
    expect(desiredRoleIds([fact({ playerRole: 'captain' })], CONFIG)).toEqual([VAL_V]);
    expect(desiredRoleIds([fact({ playerRole: 'sub' })], CONFIG)).toEqual([VAL_V]);
    expect(desiredRoleIds([fact({ playerRole: 'coach' })], CONFIG)).toEqual([]);
  });

  it('a game with no config entry, or a tier left unconfigured, grants nothing', () => {
    expect(desiredRoleIds([fact({ gameSlug: 'minecraft' })], CONFIG)).toEqual([]);
    expect(desiredRoleIds([fact({ rosterName: 'JV' })], { valorant: { varsity: VAL_V } })).toEqual([]);
  });

  it('no memberships means no roles (removed from every roster)', () => {
    expect(desiredRoleIds([], CONFIG)).toEqual([]);
  });

  it('de-duplicates', () => {
    expect(desiredRoleIds([fact(), fact({ playerRole: 'sub' })], CONFIG)).toEqual([VAL_V]);
  });
});
