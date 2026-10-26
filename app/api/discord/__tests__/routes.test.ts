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
  verifyResultCookie,
} from '@/app/lib/onboarding/discord-verification';

const ORIGIN = 'http://localhost:3000';
const TOKEN = 'raw-invite-token-abc';
const TOKEN_HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');
const UID = '123456789012345678';

const ENV_KEYS = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID'] as const;
let saved: Record<string, string | undefined> = {};

function cookieValue(res: Response, name: string): string | undefined {
  const all = res.headers.getSetCookie();
  const hit = all.find((c) => c.startsWith(`${name}=`));
  if (!hit) return undefined;
  const value = hit.split(';')[0].slice(name.length + 1);
  return value === '' ? undefined : value;
}

async function begin(token = TOKEN) {
  const req = new NextRequest(`${ORIGIN}/api/discord/start?token=${token}&school=stuyvesant&game=valorant`);
  const res = await start(req);
  const location = new URL(res.headers.get('location')!);
  return { res, location, flow: cookieValue(res, DISCORD_FLOW_COOKIE), state: location.searchParams.get('state')! };
}

function callbackReq(params: Record<string, string>, flow?: string) {
  const url = new URL(`${ORIGIN}/api/discord/callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers: flow ? { cookie: `${DISCORD_FLOW_COOKIE}=${flow}` } : {} });
}

function stubDiscordFetch(handler: (url: string, init?: RequestInit) => Response) {
  const f = vi.fn(async (url: any, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal('fetch', f);
  return f;
}

const okDiscord = (joinStatus = 201) => (url: string) => {
  if (url.endsWith('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'user-access' }), { status: 200 });
  if (url.endsWith('/users/@me')) return new Response(JSON.stringify({ id: UID, username: 'alexchen' }), { status: 200 });
  if (url.includes('/guilds/')) return new Response(joinStatus === 204 ? null : '{}', { status: joinStatus });
  return new Response('{}', { status: 404 });
};

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

describe('GET /api/discord/start', () => {
  it('redirects to Discord with a hash-bound state and an httpOnly flow cookie, without the raw token in the URL', async () => {
    const { res, location, flow } = await begin();
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds.join');
    expect(location.toString()).not.toContain(TOKEN);
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/discord/callback`);
    expect(flow).toBeTruthy();
    const header = res.headers.getSetCookie().find((c) => c.startsWith(DISCORD_FLOW_COOKIE))!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toMatch(/Path=\/api\/discord/i);
  });

  it('does not start OAuth for an invalid invite or a manager invite', async () => {
    validateInviteToken.mockResolvedValueOnce({ valid: false, status: 'expired', message: 'x' });
    let { res } = await begin();
    expect(new URL(res.headers.get('location')!).pathname).toBe('/join/stuyvesant/valorant');

    validateInviteToken.mockResolvedValueOnce({ valid: true, isManager: true });
    ({ res } = await begin());
    expect(new URL(res.headers.get('location')!).hostname).toBe('localhost');
  });

  it('returns the wizard with bot_misconfigured when env is missing', async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = await begin();
    expect(new URL(res.headers.get('location')!).searchParams.get('discord_error')).toBe('bot_misconfigured');
  });
});

describe('GET /api/discord/callback', () => {
  it('success: joins, sets a verifiable result cookie, redirects to the wizard, and clears the flow cookie', async () => {
    const f = stubDiscordFetch(okDiscord(201));
    const { flow, state } = await begin();
    const res = await callback(callbackReq({ code: 'abc', state }, flow));

    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/join/stuyvesant/valorant');
    expect(loc.searchParams.get('discord')).toBe('connected');
    expect(loc.searchParams.get('token')).toBe(TOKEN);

    const result = cookieValue(res, DISCORD_RESULT_COOKIE)!;
    expect(verifyResultCookie(result, TOKEN_HASH)).toMatchObject({
      discordUserId: UID,
      discordUsername: 'alexchen',
      inGuild: true,
    });
    const resultHeader = res.headers.getSetCookie().find((c) => c.startsWith(DISCORD_RESULT_COOKIE))!;
    expect(resultHeader).toMatch(/HttpOnly/i);
    expect(resultHeader).toMatch(/Path=\/join/i);
    expect(cookieValue(res, DISCORD_FLOW_COOKIE)).toBeUndefined();

    // The student's access token was used for the join and is not in any cookie or redirect.
    const joinCall = f.mock.calls.find(([u]) => String(u).includes('/guilds/'))!;
    expect(String(joinCall[1]?.body)).toContain('user-access');
    expect(res.headers.get('location')).not.toContain('user-access');
    expect(res.headers.getSetCookie().join(';')).not.toContain('user-access');
  });

  it('treats 204 (already a member) as in-guild', async () => {
    stubDiscordFetch(okDiscord(204));
    const { flow, state } = await begin();
    const res = await callback(callbackReq({ code: 'abc', state }, flow));
    expect(verifyResultCookie(cookieValue(res, DISCORD_RESULT_COOKIE), TOKEN_HASH)?.inGuild).toBe(true);
  });

  it('denied consent: returns to the wizard with consent_denied and no result cookie', async () => {
    const fetchSpy = stubDiscordFetch(okDiscord());
    const { flow, state } = await begin();
    const res = await callback(callbackReq({ error: 'access_denied', state }, flow));
    expect(new URL(res.headers.get('location')!).searchParams.get('discord_error')).toBe('consent_denied');
    expect(cookieValue(res, DISCORD_RESULT_COOKIE)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bad / forged state is rejected without calling Discord', async () => {
    const fetchSpy = stubDiscordFetch(okDiscord());
    const { flow } = await begin();
    const res = await callback(callbackReq({ code: 'abc', state: 'forged.state' }, flow));
    expect(new URL(res.headers.get('location')!).searchParams.get('discord_error')).toBe('state_invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a state from another browser (nonce mismatch) is rejected', async () => {
    const fetchSpy = stubDiscordFetch(okDiscord());
    const victim = await begin();
    const attacker = await begin();
    // Attacker's state delivered to the victim's browser, which holds the victim's flow cookie.
    const res = await callback(callbackReq({ code: 'abc', state: attacker.state }, victim.flow));
    expect(new URL(res.headers.get('location')!).searchParams.get('discord_error')).toBe('state_invalid');
    expect(cookieValue(res, DISCORD_RESULT_COOKIE)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('missing flow cookie (replay after success, or other browser) is a 400 with no redirect', async () => {
    const fetchSpy = stubDiscordFetch(okDiscord());
    const { state } = await begin();
    const res = await callback(callbackReq({ code: 'abc', state }));
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['server cap', () => new Response(JSON.stringify({ code: 30001 }), { status: 400 }), 'server_cap'],
    ['bot misconfigured', () => new Response('{}', { status: 403 }), 'bot_misconfigured'],
    ['rate limit', () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }), 'rate_limited'],
    ['outage', () => new Response('{}', { status: 502 }), 'outage'],
  ])('join failure: %s', async (_name, joinResponse, expected) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubDiscordFetch((url) => (url.includes('/guilds/') ? joinResponse() : okDiscord()(url)));
    const { flow, state } = await begin();
    const res = await callback(callbackReq({ code: 'abc', state }, flow));
    expect(new URL(res.headers.get('location')!).searchParams.get('discord_error')).toBe(expected);
    expect(cookieValue(res, DISCORD_RESULT_COOKIE)).toBeUndefined();
  });

  it('a rejected authorization code reports invalid_code', async () => {
    stubDiscordFetch((url) =>
      url.endsWith('/oauth2/token') ? new Response('{"error":"invalid_grant"}', { status: 400 }) : okDiscord()(url)
    );
    const { flow, state } = await begin();
    const res = await callback(callbackReq({ code: 'bad', state }, flow));
    expect(new URL(res.headers.get('location')!).searchParams.get('discord_error')).toBe('invalid_code');
  });
});
