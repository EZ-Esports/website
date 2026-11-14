import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaff = vi.fn();
const issue = vi.fn();
const revoke = vi.fn();
const list = vi.fn();

vi.mock('@/app/lib/auth', () => ({ requireStaff: () => requireStaff() }));
vi.mock('@/app/lib/password-reset/server', () => ({
  passwordResetService: {
    issue: (...a: unknown[]) => issue(...a),
    revoke: (...a: unknown[]) => revoke(...a),
    list: (...a: unknown[]) => list(...a),
  },
}));

import { issuePasswordResetLink, listPasswordResetLinks, revokePasswordResetLink } from '../password-reset-actions';
import { _resetRateLimitStore } from '@/app/lib/rate-limit';

const staff = { id: 'staff-1', permissions: BigInt(0), isOwner: true, highestRolePosition: 1 };

describe('password reset admin actions', () => {
  beforeEach(() => {
    issue.mockReset();
    revoke.mockReset();
    list.mockReset();
    requireStaff.mockReset().mockResolvedValue(staff);
    _resetRateLimitStore();
  });

  it('rejects unauthenticated callers before doing anything', async () => {
    requireStaff.mockRejectedValue(new Error('Unauthorized'));
    await expect(issuePasswordResetLink({ userId: 'u', kind: 'manager' })).rejects.toThrow('Unauthorized');
    expect(issue).not.toHaveBeenCalled();
  });

  it('rejects an unknown kind', async () => {
    expect(await issuePasswordResetLink({ userId: 'u', kind: 'admin' })).toMatchObject({ success: false });
    expect(issue).not.toHaveBeenCalled();
  });

  it('returns the one-time path once and passes the actor to the service', async () => {
    issue.mockResolvedValue({ success: true, token: 'tok123', linkId: 'l', expiresAt: new Date('2026-11-14T00:00:00Z') });
    const res = await issuePasswordResetLink({ userId: 'u', kind: 'manager' });
    expect(res).toEqual({
      success: true,
      resetPath: '/reset-password?token=tok123',
      expiresAt: '2026-11-14T00:00:00.000Z',
    });
    expect(issue).toHaveBeenCalledWith(staff, { userId: 'u', kind: 'manager' });
  });

  it('surfaces a service refusal without a token', async () => {
    issue.mockResolvedValue({ success: false, error: 'nope' });
    expect(await issuePasswordResetLink({ userId: 'u', kind: 'staff' })).toEqual({ success: false, error: 'nope' });
  });

  it('does not log the token when issuing fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    issue.mockRejectedValue(new Error('db down'));
    const res = await issuePasswordResetLink({ userId: 'u', kind: 'staff' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/token=/);
    spy.mockRestore();
  });

  it('throttles issuing per staff member', async () => {
    issue.mockResolvedValue({ success: true, token: 't', linkId: 'l', expiresAt: new Date() });
    for (let i = 0; i < 20; i++) await issuePasswordResetLink({ userId: 'u', kind: 'manager' });
    const res = await issuePasswordResetLink({ userId: 'u', kind: 'manager' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Too many/);
  });

  it('delegates revoke and list with the actor', async () => {
    revoke.mockResolvedValue({ success: true });
    list.mockResolvedValue([]);
    expect(await revokePasswordResetLink('l1')).toEqual({ success: true });
    expect(revoke).toHaveBeenCalledWith(staff, 'l1');
    expect(await listPasswordResetLinks({ userId: 'u', kind: 'manager' })).toEqual([]);
    expect(await listPasswordResetLinks({ userId: 'u', kind: 'bogus' })).toEqual([]);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
