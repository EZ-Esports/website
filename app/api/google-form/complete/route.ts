import { NextRequest, NextResponse } from 'next/server';
import { findInviteStateById, recordFormCompletion } from '@/app/lib/db/onboarding-form';
import { isValidWebhookKey, isWebhookSecretConfigured, verifyFormToken } from '@/app/lib/onboarding/google-form/token';
import { getClientIp, rateLimit } from '@/app/lib/rate-limit';

/**
 * Webhook for the onboarding Google Form's Apps Script `onFormSubmit` trigger (spec-051).
 *
 * Status codes are chosen for the script's retry policy, which retries 408, 429 and 5xx and gives
 * up on everything else:
 *
 * - 5xx: our side is not ready (secret missing) or failed. Retry.
 * - 429: too many *failed* authentications from this address. Retry after the delay.
 * - 401/400/404/409: the request itself is wrong and will never succeed. Do not retry.
 *
 * The rate limiter is keyed on the caller's address, and every request from Google's Apps Script
 * arrives from a small shared pool of addresses. So it is charged only by requests that fail
 * authentication; a caller holding the correct credential is never counted and can never be
 * locked out by someone else's bad requests from the same pool.
 */

const MAX_BODY_BYTES = 4 * 1024;
const FAILED_AUTH_LIMIT = 10;
const FAILED_AUTH_WINDOW_MS = 10 * 60_000;

function reply(status: number, body: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function bearerOf(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  if (!isWebhookSecretConfigured()) {
    // Not a client error: the deployment is missing its secret. The script should retry later.
    return reply(503, { ok: false, code: 'not_configured', error: 'The onboarding form is not configured on the server.' });
  }

  if (!isValidWebhookKey(bearerOf(request))) {
    const limited = rateLimit(`gform-auth-fail:${getClientIp(request)}`, FAILED_AUTH_LIMIT, FAILED_AUTH_WINDOW_MS);
    if (!limited.allowed) {
      const retryAfter = Math.max(1, Math.ceil(limited.resetInMs / 1000));
      return reply(
        429,
        { ok: false, code: 'rate_limited', error: 'Too many failed attempts. Try again later.' },
        { 'Retry-After': String(retryAfter) }
      );
    }
    return reply(401, { ok: false, code: 'unauthorized', error: 'Unauthorized.' });
  }

  let token: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return reply(413, { ok: false, code: 'too_large', error: 'Request body too large.' });
    token = (JSON.parse(raw) as { token?: unknown })?.token;
  } catch {
    return reply(400, { ok: false, code: 'bad_request', error: 'Expected a JSON body with a token.' });
  }
  if (typeof token !== 'string') {
    return reply(400, { ok: false, code: 'bad_request', error: 'Expected a JSON body with a token.' });
  }

  const verified = verifyFormToken(token);
  if (verified.status === 'invalid') {
    return reply(400, { ok: false, code: 'invalid_token', error: 'The verification code is not valid.' });
  }
  if (verified.status === 'expired') {
    // Not retryable: the same token will never become valid. The wizard tells the student to
    // reopen the link from the onboarding page and submit the form again.
    return reply(400, {
      ok: false,
      code: 'token_expired',
      error: 'The verification code has expired. The student must open a fresh link from the onboarding page and submit again.',
    });
  }

  try {
    const invite = await findInviteStateById(verified.kind, verified.inviteId);
    if (!invite) return reply(404, { ok: false, code: 'invite_not_found', error: 'No such invite.' });
    if (invite.status !== 'pending') {
      return reply(409, { ok: false, code: 'invite_not_pending', error: 'The invite is no longer waiting for onboarding.' });
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return reply(409, { ok: false, code: 'invite_expired', error: 'The invite has expired.' });
    }
    const created = await recordFormCompletion(verified.kind, verified.inviteId);
    return reply(200, { ok: true, recorded: created });
  } catch (err) {
    console.error('Google Form completion failed', err);
    return reply(500, { ok: false, code: 'server_error', error: 'Could not record the completion.' });
  }
}
