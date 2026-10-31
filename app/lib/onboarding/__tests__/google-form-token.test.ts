import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  FORM_TOKEN_TTL_SECONDS,
  deriveWebhookKey,
  isValidWebhookKey,
  isWebhookSecretConfigured,
  signFormToken,
  verifyFormToken,
} from '../google-form/token';

const SECRET = 'test-secret-with-at-least-sixteen-chars';
const INVITE = '11111111-1111-4111-8111-111111111111';
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  process.env.GOOGLE_FORM_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  else process.env.GOOGLE_FORM_WEBHOOK_SECRET = saved;
});

describe('form token', () => {
  it('round-trips the invite kind and id', () => {
    const { token, expiresAt } = signFormToken({ kind: 'player', inviteId: INVITE }, 1_000);
    expect(expiresAt).toBe(1_000 + FORM_TOKEN_TTL_SECONDS);
    expect(verifyFormToken(token, 1_001)).toEqual({ status: 'ok', kind: 'player', inviteId: INVITE, expiresAt });
    expect(verifyFormToken(signFormToken({ kind: 'manager', inviteId: INVITE }).token)).toMatchObject({ kind: 'manager' });
  });

  it('expires after six hours and says so (distinct from invalid)', () => {
    const { token, expiresAt } = signFormToken({ kind: 'player', inviteId: INVITE }, 1_000);
    expect(verifyFormToken(token, expiresAt - 1).status).toBe('ok');
    expect(verifyFormToken(token, expiresAt)).toEqual({ status: 'expired', kind: 'player', inviteId: INVITE });
    expect(FORM_TOKEN_TTL_SECONDS).toBe(6 * 60 * 60);
  });

  it('tolerates whitespace Google may add around the answer', () => {
    const { token } = signFormToken({ kind: 'player', inviteId: INVITE });
    expect(verifyFormToken(`  ${token}\n`).status).toBe('ok');
  });

  it('rejects a tampered payload, a tampered mac, a re-bound invite and malformed values', () => {
    const { token } = signFormToken({ kind: 'player', inviteId: INVITE });
    const [body, mac] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ t: 'gform', k: 'player', iid: '22222222-2222-4222-8222-222222222222', exp: 9_999_999_999 })
    ).toString('base64url');
    expect(verifyFormToken(`${forgedBody}.${mac}`).status).toBe('invalid');
    expect(verifyFormToken(`${body}.${mac.slice(0, -2)}AA`).status).toBe('invalid');
    for (const bad of ['', 'x', 'a.b.c', `${body}.`, '.', null, undefined, 'x'.repeat(700)]) {
      expect(verifyFormToken(bad as string).status).toBe('invalid');
    }
  });

  it('is invalid under a different server secret', () => {
    const { token } = signFormToken({ kind: 'player', inviteId: INVITE });
    process.env.GOOGLE_FORM_WEBHOOK_SECRET = 'a-completely-different-secret-value';
    expect(verifyFormToken(token).status).toBe('invalid');
  });

  it('rejects a validly signed payload whose kind is out of shape', () => {
    const key = crypto.createHmac('sha256', SECRET).update('ezesports:google-form:token:v1').digest();
    const body = Buffer.from(JSON.stringify({ t: 'gform', k: 'admin', iid: INVITE, exp: 9_999_999_999 })).toString('base64url');
    const mac = crypto.createHmac('sha256', key).update(body).digest().toString('base64url');
    expect(verifyFormToken(`${body}.${mac}`).status).toBe('invalid');
  });

  it('cannot be used when the secret is missing or too short', () => {
    const { token } = signFormToken({ kind: 'player', inviteId: INVITE });
    process.env.GOOGLE_FORM_WEBHOOK_SECRET = 'short';
    expect(isWebhookSecretConfigured()).toBe(false);
    expect(verifyFormToken(token).status).toBe('invalid');
    expect(() => signFormToken({ kind: 'player', inviteId: INVITE })).toThrow();
  });
});

describe('webhook key', () => {
  it('is derived, hex, and distinct from both the root secret and the token signing key', () => {
    const key = deriveWebhookKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toBe(SECRET);
    const tokenKey = crypto.createHmac('sha256', SECRET).update('ezesports:google-form:token:v1').digest('hex');
    expect(key).not.toBe(tokenKey);
  });

  it('accepts only the derived key, never the root secret', () => {
    expect(isValidWebhookKey(deriveWebhookKey())).toBe(true);
    expect(isValidWebhookKey(SECRET)).toBe(false);
    expect(isValidWebhookKey('')).toBe(false);
    expect(isValidWebhookKey(null)).toBe(false);
    expect(isValidWebhookKey(deriveWebhookKey() + 'x')).toBe(false);
  });

  it('accepts nothing when the secret is not configured', () => {
    const key = deriveWebhookKey();
    delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
    expect(isValidWebhookKey(key)).toBe(false);
  });
});
