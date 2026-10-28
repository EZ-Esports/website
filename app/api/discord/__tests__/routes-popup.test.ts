import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

const { validateInviteToken } = vi.hoisted(() => ({ validateInviteToken: vi.fn() }));
vi.mock('@/app/lib/onboarding/wizard-actions', () => ({ validateInviteToken }));
vi.mock('@/app/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, remaining: 1, resetInMs: 0 }),
  getClientIp: () => '127.0.0.1',
}));

import { GET as start } from '../start/route';
import { GET as callback } from '../callback/route';
import {
  DISCORD_FLOW_COOKIE,
  DISCORD_RESULT_COOKIE,
  signFlowCookie,
  verifyFlowCookie,
  verifyResultCookie,
} from '@/app/lib/onboarding/discord-verification';

const ORIGIN = 'http://localhost:3000';
const TOKEN = 'raw-invite-token-abc';
const TOKEN_HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');
const UID = '123456789012345678';

const ENV_KEYS = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID'] as const;
let saved: Record<string, string | undefined> = {};

function cookieValue(res: Response, name: string): string | undefined {
  const hit = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  if (!hit) return undefined;
  const value = hit.split(';')[0].slice(name.length + 1);
  return value === '' ? undefined : value;
}

async function begin(extra = '') {
  const res = await start(new NextRequest(`${ORIGIN}/api/discord/start?token=${TOKEN}&school=stuyvesant&game=valorant${extra}`));
  const location = new URL(res.headers.get('location')!);
  return { res, location, flow: cookieValue(res, DISCORD_FLOW_COOKIE), state: location.searchParams.get('state')! };
}

function callbackReq(params: Record<string, string>, flow?: string) {
  const url = new URL(`${ORIGIN}/api/discord/callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers: flow ? { cookie: `${DISCORD_FLOW_COOKIE}=${flow}` } : {} });
}

function stubDiscordFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.endsWith('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'user-access' }), { status: 200 });
      if (u.endsWith('/users/@me')) return new Response(JSON.stringify({ id: UID, username: 'alexchen' }), { status: 200 });
      return new Response('{}', { status: 201 });
    })
  );
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.DISCORD_CLIENT_ID = 'client-id';
  process.env.DISCORD_CLIENT_SECRET = 'client-secret-test';
  process.env.DISCORD_BOT_TOKEN = 'bot-token-test';
  process.env.DISCORD_GUILD_ID = '987654321098765432';
  validateInviteToken.mockResolvedValue({ valid: true, isManager: false });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('second-tab (popup) Discord flow', () => {
  it('records popup=1 in the signed flow cookie, and not otherwise', async () => {
    const popup = await begin('&popup=1');
    expect(verifyFlowCookie(popup.flow)).toMatchObject({ popup: true });
    const plain = await begin();
    expect(verifyFlowCookie(plain.flow)?.popup).toBeUndefined();
    const other = await begin('&popup=yes');
    expect(verifyFlowCookie(other.flow)?.popup).toBeUndefined();
  });

  it('a successful callback returns to the join page with popup=1 and still sets the verified cookie', async () => {
    const { flow, state } = await begin('&popup=1');
    stubDiscordFetch();
    const cb = await callback(callbackReq({ code: 'abc', state }, flow));
    const loc = new URL(cb.headers.get('location')!);
    expect(loc.pathname).toBe('/join/stuyvesant/valorant');
    expect(loc.searchParams.get('discord')).toBe('connected');
    expect(loc.searchParams.get('popup')).toBe('1');
    expect(verifyResultCookie(cookieValue(cb, DISCORD_RESULT_COOKIE), TOKEN_HASH)).toMatchObject({
      discordUserId: UID,
      inGuild: true,
    });
    // Single use: the flow cookie is consumed.
    expect(cb.headers.getSetCookie().find((c) => c.startsWith(`${DISCORD_FLOW_COOKIE}=`))).toMatch(/Max-Age=0/i);
  });

  it('every failure keeps popup=1 (state mismatch, consent denied, missing code, Discord error)', async () => {
    const { flow, state } = await begin('&popup=1');
    const denied = await callback(callbackReq({ error: 'access_denied', state }, flow));
    expect(new URL(denied.headers.get('location')!).searchParams.get('popup')).toBe('1');
    expect(new URL(denied.headers.get('location')!).searchParams.get('discord_error')).toBe('consent_denied');

    const bad = await callback(callbackReq({ code: 'abc', state: 'forged' }, flow));
    expect(new URL(bad.headers.get('location')!).searchParams.get('discord_error')).toBe('state_invalid');
    expect(new URL(bad.headers.get('location')!).searchParams.get('popup')).toBe('1');

    const noCode = await callback(callbackReq({ state }, flow));
    expect(new URL(noCode.headers.get('location')!).searchParams.get('popup')).toBe('1');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = await callback(callbackReq({ code: 'abc', state }, flow));
    expect(new URL(failed.headers.get('location')!).searchParams.get('discord_error')).toBeTruthy();
    expect(new URL(failed.headers.get('location')!).searchParams.get('popup')).toBe('1');
  });

  it('start errors keep popup=1 too (bad Discord config, invalid invite)', async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const misconfigured = await begin('&popup=1');
    expect(misconfigured.location.searchParams.get('popup')).toBe('1');
    expect(misconfigured.location.searchParams.get('discord_error')).toBe('bot_misconfigured');

    process.env.DISCORD_BOT_TOKEN = 'bot-token-test';
    validateInviteToken.mockResolvedValueOnce({ valid: false, status: 'expired', message: 'x' });
    const invalid = await begin('&popup=1');
    expect(invalid.location.searchParams.get('popup')).toBe('1');
    expect(invalid.flow).toBeUndefined();
  });

  it('the same-tab flow is unchanged: no popup param on the way back', async () => {
    const { flow, state } = await begin();
    stubDiscordFetch();
    const cb = await callback(callbackReq({ code: 'abc', state }, flow));
    const loc = new URL(cb.headers.get('location')!);
    expect(loc.searchParams.get('discord')).toBe('connected');
    expect(loc.searchParams.has('popup')).toBe(false);
  });

  it('a flow cookie issued before the popup field existed still verifies and behaves as same-tab', async () => {
    const legacy = signFlowCookie({ nonce: 'n'.repeat(8), inviteHash: TOKEN_HASH, token: TOKEN, school: 'stuyvesant', game: 'valorant' });
    expect(verifyFlowCookie(legacy)).toMatchObject({ school: 'stuyvesant' });
    expect(verifyFlowCookie(legacy)?.popup).toBeUndefined();
    const cb = await callback(callbackReq({ error: 'access_denied', state: 'whatever' }, legacy));
    const loc = new URL(cb.headers.get('location')!);
    expect(loc.pathname).toBe('/join/stuyvesant/valorant');
    expect(loc.searchParams.has('popup')).toBe(false);
  });
});
