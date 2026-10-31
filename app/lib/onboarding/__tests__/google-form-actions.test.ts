import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

const { findInviteByTokenHash, hasFormCompletion, getOnboardingFormConfig } = vi.hoisted(() => ({
  findInviteByTokenHash: vi.fn(),
  hasFormCompletion: vi.fn(),
  getOnboardingFormConfig: vi.fn(),
}));
vi.mock('@/app/lib/db/onboarding', () => ({ findInviteByTokenHash }));
vi.mock('@/app/lib/db/onboarding-form', () => ({ hasFormCompletion }));
vi.mock('../google-form/config', () => ({ getOnboardingFormConfig }));

import {
  getOnboardingFormState,
  issueOnboardingFormLink,
  resolveOnboardingFormState,
} from '../google-form-actions';
import { verifyFormToken } from '../google-form/token';
import { _resetRateLimitStore } from '@/app/lib/rate-limit';

const SECRET = 'actions-test-secret-sixteen-plus';
const INVITE = '44444444-4444-4444-8444-444444444444';
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789/viewform';
const TOKEN = 'raw-invite-token';
let saved: string | undefined;

const enabled = { enabled: true, formUrl: FORM, entryId: '987654321', secretConfigured: true };

beforeEach(() => {
  saved = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  process.env.GOOGLE_FORM_WEBHOOK_SECRET = SECRET;
  _resetRateLimitStore();
  findInviteByTokenHash.mockReset().mockResolvedValue({
    kind: 'player',
    invite: { id: INVITE, status: 'pending', expiresAt: new Date(Date.now() + 86_400_000) },
  });
  hasFormCompletion.mockReset().mockResolvedValue(false);
  getOnboardingFormConfig.mockReset().mockResolvedValue(enabled);
});
afterEach(() => {
  if (saved === undefined) delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  else process.env.GOOGLE_FORM_WEBHOOK_SECRET = saved;
});

describe('resolveOnboardingFormState', () => {
  it('has no form step when staff have not configured one, without touching the completions table', async () => {
    getOnboardingFormConfig.mockResolvedValue({ ...enabled, enabled: false });
    expect(await resolveOnboardingFormState('player', INVITE)).toEqual({ enabled: false, completed: false });
    expect(hasFormCompletion).not.toHaveBeenCalled();
  });

  it('reports completion from the database', async () => {
    hasFormCompletion.mockResolvedValue(true);
    expect(await resolveOnboardingFormState('manager', INVITE)).toEqual({ enabled: true, completed: true });
    expect(hasFormCompletion).toHaveBeenCalledWith('manager', INVITE);
  });
});

describe('getOnboardingFormState', () => {
  it('looks the invite up by the token hash and answers from the database', async () => {
    hasFormCompletion.mockResolvedValue(true);
    expect(await getOnboardingFormState(TOKEN)).toEqual({ enabled: true, completed: true });
    expect(findInviteByTokenHash).toHaveBeenCalledWith(crypto.createHash('sha256').update(TOKEN).digest('hex'));
  });

  it('is never "completed" for an unknown, non-pending or expired invite', async () => {
    findInviteByTokenHash.mockResolvedValueOnce(undefined);
    expect((await getOnboardingFormState(TOKEN)).completed).toBe(false);
    findInviteByTokenHash.mockResolvedValueOnce({ kind: 'player', invite: { id: INVITE, status: 'submitted', expiresAt: null } });
    expect((await getOnboardingFormState(TOKEN)).completed).toBe(false);
    findInviteByTokenHash.mockResolvedValueOnce({ kind: 'player', invite: { id: INVITE, status: 'pending', expiresAt: new Date(0) } });
    expect((await getOnboardingFormState(TOKEN)).completed).toBe(false);
    expect((await getOnboardingFormState('  ')).completed).toBe(false);
  });
});

describe('issueOnboardingFormLink', () => {
  it('returns the form link with a verification code prefilled for exactly this invite', async () => {
    const result = await issueOnboardingFormLink(TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(FORM);
    expect(url.searchParams.get('usp')).toBe('pp_url');
    const code = url.searchParams.get('entry.987654321')!;
    expect(verifyFormToken(code)).toMatchObject({ status: 'ok', kind: 'player', inviteId: INVITE });
    expect(result.expiresAt).toBeGreaterThan(Date.now() + 5 * 3600_000);
    expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 6 * 3600_000 + 1000);
  });

  it('refuses when the invite is not live or the form is not configured, and limits repeated requests', async () => {
    findInviteByTokenHash.mockResolvedValueOnce(undefined);
    expect((await issueOnboardingFormLink(TOKEN)).ok).toBe(false);
    getOnboardingFormConfig.mockResolvedValueOnce({ ...enabled, enabled: false });
    expect((await issueOnboardingFormLink(TOKEN)).ok).toBe(false);
    for (let i = 0; i < 40; i++) await issueOnboardingFormLink(TOKEN);
    const limited = await issueOnboardingFormLink(TOKEN);
    expect(limited).toMatchObject({ ok: false });
  });
});
