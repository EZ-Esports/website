import crypto from 'node:crypto';

/**
 * Signed verification tokens and the webhook credential for the onboarding Google Form (spec-051).
 *
 * One env var, GOOGLE_FORM_WEBHOOK_SECRET, is the root. Two independent keys are derived from it
 * with domain-separation labels, so compromising one never yields the other:
 *
 * - the **token key** signs the per-invite verification token. It never leaves the server.
 * - the **webhook key** is the bearer credential the Apps Script sends. Staff copy it from the
 *   staff page into the script's properties. A leaked script property can post completions for
 *   tokens the server issued, but cannot mint a token for a different invite.
 *
 * The token is bound to one invite (kind and id) and expires, so a student cannot reuse a token
 * from someone else's link and a stale link stops working. Discord's cookies use a different root
 * (DISCORD_CLIENT_SECRET), so the two schemes cannot be substituted for each other.
 */

export type InviteKind = 'player' | 'manager';

export const FORM_TOKEN_TTL_SECONDS = 6 * 60 * 60;
/** A secret shorter than this is treated as not configured, so a placeholder never silently "works". */
export const MIN_SECRET_LENGTH = 16;

const TOKEN_LABEL = 'ezesports:google-form:token:v1';
const WEBHOOK_LABEL = 'ezesports:google-form:webhook:v1';

const nowSec = () => Math.floor(Date.now() / 1000);
const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

export function getWebhookRootSecret(): string | null {
  const secret = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export function isWebhookSecretConfigured(): boolean {
  return getWebhookRootSecret() !== null;
}

function derive(label: string): Buffer {
  const root = getWebhookRootSecret();
  if (!root) throw new Error('GOOGLE_FORM_WEBHOOK_SECRET is required for the onboarding form.');
  return crypto.createHmac('sha256', root).update(label).digest();
}

/** The credential staff paste into the Apps Script as WEBHOOK_KEY. Hex, 64 characters. */
export function deriveWebhookKey(): string {
  return derive(WEBHOOK_LABEL).toString('hex');
}

/** Constant-time check of a presented bearer credential against the derived webhook key. */
export function isValidWebhookKey(presented: string | null | undefined): boolean {
  if (!presented || !isWebhookSecretConfigured()) return false;
  // Hash both sides first so the compare is fixed-length whatever was presented.
  const a = crypto.createHash('sha256').update(presented).digest();
  const b = crypto.createHash('sha256').update(deriveWebhookKey()).digest();
  return crypto.timingSafeEqual(a, b);
}

interface TokenPayload {
  t: 'gform';
  k: InviteKind;
  iid: string;
  exp: number;
}

export function signFormToken(
  input: { kind: InviteKind; inviteId: string },
  now = nowSec()
): { token: string; expiresAt: number } {
  const exp = now + FORM_TOKEN_TTL_SECONDS;
  const payload: TokenPayload = { t: 'gform', k: input.kind, iid: input.inviteId, exp };
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', derive(TOKEN_LABEL)).update(body).digest();
  return { token: `${body}.${b64(mac)}`, expiresAt: exp };
}

export type FormTokenResult =
  | { status: 'ok'; kind: InviteKind; inviteId: string; expiresAt: number }
  /** Authentic but past its lifetime: not retryable, the student has to open a fresh link. */
  | { status: 'expired'; kind: InviteKind; inviteId: string }
  | { status: 'invalid' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyFormToken(value: string | null | undefined, now = nowSec()): FormTokenResult {
  if (!value || typeof value !== 'string' || value.length > 600) return { status: 'invalid' };
  // Google may add stray whitespace or line breaks around a pasted answer.
  const parts = value.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { status: 'invalid' };
  const [body, mac] = parts;

  let expected: Buffer;
  try {
    expected = crypto.createHmac('sha256', derive(TOKEN_LABEL)).update(body).digest();
  } catch {
    return { status: 'invalid' };
  }
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { status: 'invalid' };

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    return { status: 'invalid' };
  }
  if (
    payload?.t !== 'gform' ||
    (payload.k !== 'player' && payload.k !== 'manager') ||
    typeof payload.iid !== 'string' ||
    !UUID.test(payload.iid) ||
    typeof payload.exp !== 'number'
  ) {
    return { status: 'invalid' };
  }
  if (payload.exp <= now) return { status: 'expired', kind: payload.k, inviteId: payload.iid };
  return { status: 'ok', kind: payload.k, inviteId: payload.iid, expiresAt: payload.exp };
}
