import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { findInviteStateById, recordFormCompletion } = vi.hoisted(() => ({
  findInviteStateById: vi.fn(),
  recordFormCompletion: vi.fn(),
}));
vi.mock('@/app/lib/db/onboarding-form', () => ({ findInviteStateById, recordFormCompletion }));

import { POST } from '../complete/route';
import { _resetRateLimitStore } from '@/app/lib/rate-limit';
import { deriveWebhookKey, signFormToken } from '@/app/lib/onboarding/google-form/token';

const SECRET = 'route-test-secret-sixteen-plus-chars';
const INVITE = '33333333-3333-4333-8333-333333333333';
let saved: string | undefined;

function req(opts: { key?: string | null; body?: unknown; raw?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': opts.ip ?? '74.125.0.1' };
  const key = opts.key === undefined ? deriveWebhookKey() : opts.key;
  if (key) headers.authorization = `Bearer ${key}`;
  return new NextRequest('http://localhost:3000/api/google-form/complete', {
    method: 'POST',
    headers,
    body: opts.raw ?? JSON.stringify(opts.body ?? { token: signFormToken({ kind: 'player', inviteId: INVITE }).token }),
  });
}

beforeEach(() => {
  saved = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  process.env.GOOGLE_FORM_WEBHOOK_SECRET = SECRET;
  _resetRateLimitStore();
  findInviteStateById.mockReset().mockResolvedValue({ status: 'pending', expiresAt: new Date(Date.now() + 86_400_000) });
  recordFormCompletion.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  if (saved === undefined) delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  else process.env.GOOGLE_FORM_WEBHOOK_SECRET = saved;
  vi.restoreAllMocks();
});

describe('POST /api/google-form/complete: configuration and authentication', () => {
  it('answers 503 (retryable) when the server secret is missing', async () => {
    const request = req({ key: 'anything' });
    delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
    const res = await POST(request);
    expect(res.status).toBe(503);
    expect(recordFormCompletion).not.toHaveBeenCalled();
  });

  it('answers 401 without a bearer key, with the wrong key, and with the root secret itself', async () => {
    for (const key of [null, 'wrong', SECRET]) {
      const res = await POST(req({ key }));
      expect(res.status).toBe(401);
    }
    expect(recordFormCompletion).not.toHaveBeenCalled();
  });

  it('answers 429 with Retry-After once one address has failed authentication too often', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) last = await POST(req({ key: 'wrong' }));
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('never counts or blocks a request that authenticates, even from an address that is rate limited', async () => {
    for (let i = 0; i < 25; i++) await POST(req({ key: 'wrong' })); // exhaust the shared address
    const ok = await POST(req());
    expect(ok.status).toBe(200);
    // And a thousand good requests do not themselves trip the limiter.
    for (let i = 0; i < 30; i++) expect((await POST(req({ ip: '8.8.8.8' }))).status).toBe(200);
    expect((await POST(req({ key: 'wrong', ip: '8.8.8.8' }))).status).toBe(401);
  });
});

describe('POST /api/google-form/complete: token and invite checks', () => {
  it('rejects a malformed body and an oversized body without retry hints (4xx)', async () => {
    expect((await POST(req({ raw: 'not json' }))).status).toBe(400);
    expect((await POST(req({ body: { token: 5 } }))).status).toBe(400);
    expect((await POST(req({ raw: JSON.stringify({ token: 'x'.repeat(10_000) }) }))).status).toBe(413);
  });

  it('rejects a forged token with 400 invalid_token', async () => {
    const res = await POST(req({ body: { token: 'forged.token' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('invalid_token');
  });

  it('rejects an expired token with 400 token_expired, a non-retryable status that tells the student to reopen the link', async () => {
    const { token } = signFormToken({ kind: 'player', inviteId: INVITE }, Math.floor(Date.now() / 1000) - 7 * 3600);
    const res = await POST(req({ body: { token } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('token_expired');
    expect(json.error).toMatch(/fresh link/i);
    expect(recordFormCompletion).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown invite and 409 for an invite that is no longer pending or has expired', async () => {
    findInviteStateById.mockResolvedValueOnce(undefined);
    expect((await POST(req())).status).toBe(404);
    findInviteStateById.mockResolvedValueOnce({ status: 'submitted', expiresAt: null });
    expect((await POST(req())).status).toBe(409);
    findInviteStateById.mockResolvedValueOnce({ status: 'pending', expiresAt: new Date(Date.now() - 1000) });
    expect((await POST(req())).status).toBe(409);
    expect(recordFormCompletion).not.toHaveBeenCalled();
  });
});

describe('POST /api/google-form/complete: recording', () => {
  it('records a completion for the invite named by the token', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, recorded: true });
    expect(findInviteStateById).toHaveBeenCalledWith('player', INVITE);
    expect(recordFormCompletion).toHaveBeenCalledWith('player', INVITE);
  });

  it('is idempotent: a re-delivered or repeated submission still answers 200', async () => {
    recordFormCompletion.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const first = await POST(req());
    const second = await POST(req());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, recorded: false });
  });

  it('records manager invites under the manager kind', async () => {
    const { token } = signFormToken({ kind: 'manager', inviteId: INVITE });
    await POST(req({ body: { token } }));
    expect(recordFormCompletion).toHaveBeenCalledWith('manager', INVITE);
  });

  it('answers 500 (retryable) when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    recordFormCompletion.mockRejectedValueOnce(new Error('db down'));
    expect((await POST(req())).status).toBe(500);
  });

  it('never caches', async () => {
    expect((await POST(req())).headers.get('Cache-Control')).toBe('no-store');
  });
});
