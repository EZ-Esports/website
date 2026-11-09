import crypto from 'node:crypto';
import { isDiscordSnowflake } from './adapters/discord-rest';

/**
 * Signed, short-lived tokens for the Discord OAuth round trip. Three kinds share one
 * HMAC-SHA256 scheme, distinguished by a `t` field so one can never be replayed as another:
 *
 * - `state`  : sent to Discord and returned on the callback. Binds the invite (by hash) and a nonce.
 * - `flow`   : httpOnly cookie set at /start. Holds the same nonce so a state captured from another
 *              browser is useless, plus what the callback needs to send the student back to the wizard.
 * - `result` : httpOnly cookie set after a successful join. The only thing the submission pipeline
 *              trusts about the student's Discord identity.
 *
 * The signing key is derived from DISCORD_CLIENT_SECRET (a server-only secret that already
 * must exist for this feature) with a domain-separation label, so no extra env var is needed.
 * The derived key, not the raw client secret, is what signs cookies.
 */

export const DISCORD_FLOW_COOKIE = 'ez_discord_flow';
export const DISCORD_RESULT_COOKIE = 'ez_discord_verified';
export const DISCORD_FLOW_COOKIE_PATH = '/api/discord';
/** The wizard (and its server action POSTs) live under /join. */
export const DISCORD_RESULT_COOKIE_PATH = '/join';

export const DISCORD_FLOW_TTL_SECONDS = 10 * 60;
/** Long enough to finish the remaining wizard steps, short enough to limit stolen-cookie value. */
export const DISCORD_RESULT_TTL_SECONDS = 60 * 60;

const KEY_LABEL = 'ezesports:discord-onboarding:v1';

function signingKey(): Buffer {
  const secret = process.env.DISCORD_CLIENT_SECRET;
  if (!secret) {
    throw new Error('DISCORD_CLIENT_SECRET is required to sign Discord onboarding tokens.');
  }
  return crypto.createHmac('sha256', secret).update(KEY_LABEL).digest();
}

export interface DiscordStatePayload {
  t: 'state';
  /** SHA-256 hash of the invite token (never the raw token). */
  ih: string;
  /** Random nonce, mirrored in the flow cookie. */
  n: string;
  exp: number;
}

export interface DiscordFlowPayload {
  t: 'flow';
  n: string;
  ih: string;
  /** Raw invite token, kept only in this httpOnly cookie so it never appears in the OAuth URL. */
  tok: string;
  school: string;
  game: string;
  /**
   * True when the flow was started from a second tab, so the callback sends that tab to the
   * "you can close this tab" page. Absent on cookies issued before this existed, which behave as before.
   */
  popup?: boolean;
  exp: number;
}

export interface DiscordResultPayload {
  t: 'result';
  /** Discord snowflake. */
  uid: string;
  /** Discord handle as returned by Discord, not typed by the student. */
  un: string;
  inGuild: boolean;
  ih: string;
  exp: number;
}

type Signable = DiscordStatePayload | DiscordFlowPayload | DiscordResultPayload;

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

function sign(payload: Signable): string {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', signingKey()).update(body).digest();
  return `${body}.${b64(mac)}`;
}

function verify<T extends Signable>(
  value: string | undefined | null,
  kind: T['t'],
  nowSeconds: number
): T | null {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;

  let expected: Buffer;
  try {
    expected = crypto.createHmac('sha256', signingKey()).update(body).digest();
  } catch {
    return null;
  }
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    if (payload?.t !== kind) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function newNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function signState(input: { inviteHash: string; nonce: string }, now = nowSec()): string {
  return sign({ t: 'state', ih: input.inviteHash, n: input.nonce, exp: now + DISCORD_FLOW_TTL_SECONDS });
}

export function verifyState(value: string | undefined | null, now = nowSec()) {
  return verify<DiscordStatePayload>(value, 'state', now);
}

export function signFlowCookie(
  input: { nonce: string; inviteHash: string; token: string; school: string; game: string; popup?: boolean },
  now = nowSec()
): string {
  return sign({
    t: 'flow',
    n: input.nonce,
    ih: input.inviteHash,
    tok: input.token,
    school: input.school,
    game: input.game,
    ...(input.popup ? { popup: true } : {}),
    exp: now + DISCORD_FLOW_TTL_SECONDS,
  });
}

export function verifyFlowCookie(value: string | undefined | null, now = nowSec()) {
  return verify<DiscordFlowPayload>(value, 'flow', now);
}

export function signResultCookie(
  input: { discordUserId: string; discordUsername: string; inGuild: boolean; inviteHash: string },
  now = nowSec()
): string {
  return sign({
    t: 'result',
    uid: input.discordUserId,
    un: input.discordUsername,
    inGuild: input.inGuild,
    ih: input.inviteHash,
    exp: now + DISCORD_RESULT_TTL_SECONDS,
  });
}

export interface VerifiedDiscord {
  discordUserId: string;
  discordUsername: string;
  inGuild: boolean;
  inviteHash: string;
}

/** Returns the verified identity only if the signature, expiry, shape and invite binding all hold. */
export function verifyResultCookie(
  value: string | undefined | null,
  expectedInviteHash: string,
  now = nowSec()
): VerifiedDiscord | null {
  const payload = verify<DiscordResultPayload>(value, 'result', now);
  if (!payload) return null;
  if (!isDiscordSnowflake(payload.uid) || typeof payload.un !== 'string' || !payload.un) return null;
  if (typeof payload.inGuild !== 'boolean') return null;
  if (typeof payload.ih !== 'string' || !hashesEqual(payload.ih, expectedInviteHash)) return null;
  return {
    discordUserId: payload.uid,
    discordUsername: payload.un,
    inGuild: payload.inGuild,
    inviteHash: payload.ih,
  };
}
