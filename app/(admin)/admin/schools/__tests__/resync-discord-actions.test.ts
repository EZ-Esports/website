import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Permissions } from '@/app/lib/roles';

const SCHOOL = '0b1d3c3e-6a6c-4a52-8f55-1d5d6c1f9a11';
const MEMBER = '5d1f3c3e-6a6c-4a52-8f55-1d5d6c1f9a22';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(async (_p: bigint): Promise<unknown> => ({})),
  memberInSchool: vi.fn(async (_m: string, _s: string) => true),
  schoolMembers: [{ id: 'm1' }, { id: 'm2' }] as Array<{ id: string }>,
  preview: vi.fn(async (_ids: string[]): Promise<unknown> => null),
  sync: vi.fn(async (_ids: string[]): Promise<unknown> => ({ status: 'ok', synced: 2, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 0, failures: [] })),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/app/lib/db/roster-scope', () => ({ memberInSchool: mocks.memberInSchool }));
vi.mock('@/app/lib/onboarding/tier-role-sync', () => ({ syncTierRolesForMembers: mocks.sync, previewTierRolesForMembers: mocks.preview }));
vi.mock('@/app/lib/db', () => ({
  db: { select: () => ({ from: () => ({ where: async () => mocks.schoolMembers }) }) },
}));

import { resyncDiscordRoles } from '../[schoolId]/rosters/discord-actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({});
  mocks.memberInSchool.mockResolvedValue(true);
  mocks.preview.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('resyncDiscordRoles', () => {
  it('requires MANAGE_ROSTERS before doing anything, and a denial propagates', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(resyncDiscordRoles(SCHOOL)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_ROSTERS);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('resyncs every member of the school and returns the report as a result object', async () => {
    const res = await resyncDiscordRoles(SCHOOL);
    expect(mocks.sync).toHaveBeenCalledWith(['m1', 'm2']);
    expect(res).toEqual({ success: true, report: expect.objectContaining({ synced: 2 }) });
  });

  it('resyncs one member only after checking they belong to the school', async () => {
    const res = await resyncDiscordRoles(SCHOOL, MEMBER);
    expect(mocks.memberInSchool).toHaveBeenCalledWith(MEMBER, SCHOOL);
    expect(mocks.sync).toHaveBeenCalledWith([MEMBER]);
    expect(res.success).toBe(true);
  });

  it('refuses a member of another school', async () => {
    mocks.memberInSchool.mockResolvedValue(false);
    const res = await resyncDiscordRoles(SCHOOL, MEMBER);
    expect(res).toEqual({ success: false, error: 'That member was not found for this school.' });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('rejects malformed ids without touching Discord', async () => {
    expect(await resyncDiscordRoles('nope')).toEqual({ success: false, error: 'Invalid school.' });
    expect(await resyncDiscordRoles(SCHOOL, 'nope')).toEqual({ success: false, error: 'Invalid member.' });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('turns a disabled sync into an explanatory error result', async () => {
    mocks.sync.mockResolvedValueOnce({ status: 'disabled', disabledReason: 'config_unset', synced: 0, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 0, failures: [] });
    const res = await resyncDiscordRoles(SCHOOL);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain('DISCORD_TIER_ROLES');
  });

  it('returns (never throws) a generic message when the sync itself throws', async () => {
    mocks.sync.mockRejectedValueOnce(new Error('secret detail'));
    const res = await resyncDiscordRoles(SCHOOL);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).not.toContain('secret');
  });

  it('passes per-member failures through masked as given by the report', async () => {
    mocks.sync.mockResolvedValueOnce({ status: 'ok', synced: 0, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 1, failures: [{ member: '5d1f3c3e...', reason: 'bot_misconfigured' }] });
    const res = await resyncDiscordRoles(SCHOOL);
    expect(res.success && res.report.failures[0].member).toBe('5d1f3c3e...');
  });

  it('labels failed members with initials plus the uuid prefix, and never returns the full id', async () => {
    mocks.schoolMembers = [{ id: MEMBER, first: 'Ana', last: 'Lee' } as never];
    mocks.sync.mockResolvedValueOnce({ status: 'ok', synced: 0, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 1, failures: [{ member: '5d1f3c3e...', memberId: MEMBER, reason: 'outage' }] });
    const res = await resyncDiscordRoles(SCHOOL);
    expect(res.success && res.report.failures[0]).toEqual({ member: 'A. L. (5d1f3c3e...)', reason: 'outage' });
    expect(JSON.stringify(res)).not.toContain(MEMBER);
    mocks.schoolMembers = [{ id: 'm1' }, { id: 'm2' }];
  });

  it('passes a blocked report through so the panel can explain it', async () => {
    mocks.sync.mockResolvedValueOnce({ status: 'blocked', blockedReason: 'role_not_below_bot', synced: 0, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 0, failures: [] });
    const res = await resyncDiscordRoles(SCHOOL);
    expect(res.success && res.report.blockedReason).toBe('role_not_below_bot');
  });

  describe('strip-all guard (school-wide only)', () => {
    const strip = { members: 5, withDiscord: 4, withTierRoles: 0, stripAll: true };

    it('refuses a school-wide resync that would remove every tier role, without calling the sync', async () => {
      mocks.preview.mockResolvedValue(strip);
      const res = await resyncDiscordRoles(SCHOOL);
      expect(res).toMatchObject({ success: false, stripAll: { withDiscord: 4, members: 5 } });
      expect(mocks.sync).not.toHaveBeenCalled();
    });

    it('runs once the staff member explicitly confirms again', async () => {
      mocks.preview.mockResolvedValue(strip);
      const res = await resyncDiscordRoles(SCHOOL, undefined, { allowStripAll: true });
      expect(res.success).toBe(true);
      expect(mocks.sync).toHaveBeenCalled();
    });

    it('does not apply to a single-member resync', async () => {
      mocks.preview.mockResolvedValue(strip);
      const res = await resyncDiscordRoles(SCHOOL, MEMBER);
      expect(res.success).toBe(true);
      expect(mocks.preview).not.toHaveBeenCalled();
    });

    it('does not trigger when some students would keep a tier role', async () => {
      mocks.preview.mockResolvedValue({ ...strip, withTierRoles: 1, stripAll: false });
      expect((await resyncDiscordRoles(SCHOOL)).success).toBe(true);
    });
  });
});

describe('rosters page time limit', () => {
  it('exports a maxDuration so the whole-school resync (a server action on this page) is not cut at the platform default', () => {
    const page = readFileSync(join(__dirname, '..', '[schoolId]', 'rosters', 'page.tsx'), 'utf8');
    expect(page).toMatch(/export const maxDuration = (\d+);/);
    const seconds = Number(/export const maxDuration = (\d+);/.exec(page)![1]);
    expect(seconds).toBeGreaterThanOrEqual(30);
    expect(seconds).toBeLessThanOrEqual(60);
  });
});
