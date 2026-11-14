import { beforeEach, describe, expect, it, vi } from 'vitest';

const redeem = vi.fn();
const blocked = vi.fn();
const recordFailure = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));
vi.mock('@/app/lib/password-reset/server', () => ({ passwordResetService: { redeem: (...a: unknown[]) => redeem(...a) } }));
vi.mock('@/app/lib/password-reset/rate-limit', () => ({ isResetBlocked: () => blocked(), recordFailedResetAttempt: () => recordFailure() }));

import { resetPassword } from '../actions';
import { INVALID_RESET_LINK_MESSAGE } from '@/app/lib/password-reset/core';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe('resetPassword action', () => {
  beforeEach(() => {
    redeem.mockReset();
    redirect.mockClear();
    blocked.mockReset().mockResolvedValue(false);
    recordFailure.mockReset();
  });

  it('redirects a manager to the portal login with a notice and creates no session', async () => {
    redeem.mockResolvedValue({ ok: true, kind: 'manager' });
    await expect(
      resetPassword(form({ token: 't', password: 'long-enough-1', confirm: 'long-enough-1' })),
    ).rejects.toThrow('NEXT_REDIRECT:/portal/login?message=password-reset');
    expect(redeem).toHaveBeenCalledWith('t', 'long-enough-1');
  });

  it('redirects staff to the staff login', async () => {
    redeem.mockResolvedValue({ ok: true, kind: 'staff' });
    await expect(
      resetPassword(form({ token: 't', password: 'long-enough-1', confirm: 'long-enough-1' })),
    ).rejects.toThrow('NEXT_REDIRECT:/login?message=password-reset');
  });

  it('returns the generic message for a dead link', async () => {
    redeem.mockResolvedValue({ ok: false, error: INVALID_RESET_LINK_MESSAGE, retryable: false });
    const res = await resetPassword(form({ token: 'x', password: 'long-enough-1', confirm: 'long-enough-1' }));
    expect(res).toEqual({ error: INVALID_RESET_LINK_MESSAGE });
    expect(redirect).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledTimes(1);
  });

  it('uses the generic message when the service throws', async () => {
    redeem.mockRejectedValue(new Error('db exploded'));
    const res = await resetPassword(form({ token: 'x', password: 'long-enough-1', confirm: 'long-enough-1' }));
    expect(res).toEqual({ error: INVALID_RESET_LINK_MESSAGE });
  });

  it('applies the sign-up password rules before touching the token', async () => {
    expect(await resetPassword(form({ token: 'x', password: 'short', confirm: 'short' }))).toEqual({
      error: 'Password must be at least 8 characters.',
    });
    expect(await resetPassword(form({ token: 'x', password: 'long-enough-1', confirm: 'different-1' }))).toEqual({
      error: 'Passwords do not match.',
    });
    expect(redeem).not.toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('does not count a successful reset or a retryable password error against the throttle', async () => {
    redeem.mockResolvedValue({ ok: false, error: 'Could not update', retryable: true });
    await resetPassword(form({ token: 'x', password: 'long-enough-1', confirm: 'long-enough-1' }));
    redeem.mockResolvedValue({ ok: true, kind: 'manager' });
    await expect(
      resetPassword(form({ token: 'x', password: 'long-enough-1', confirm: 'long-enough-1' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('is throttled per IP', async () => {
    blocked.mockResolvedValue(true);
    const res = await resetPassword(form({ token: 'x', password: 'long-enough-1', confirm: 'long-enough-1' }));
    expect(res.error).toMatch(/Too many attempts/);
    expect(redeem).not.toHaveBeenCalled();
  });
});
