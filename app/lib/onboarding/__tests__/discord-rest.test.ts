import { describe, it, expect, vi } from 'vitest';
import {
  DiscordError,
  DiscordRestAdapter,
  buildAuthorizeUrl,
  exchangeCode,
  fetchCurrentUser,
} from '../adapters/discord-rest';

const UID = '123456789012345678';

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function adapterWith(fetchImpl: any, sleep = vi.fn(async (_ms: number) => {})) {
  return {
    sleep,
    adapter: new DiscordRestAdapter({ botToken: 'bot-token', guildId: 'guild-1', fetchImpl, sleep }),
  };
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DiscordError);
    return (e as DiscordError).code;
  }
  throw new Error('expected rejection');
}

describe('DiscordRestAdapter.addMemberToGuild', () => {
  it('201 means joined, using the bot token and the user token only in the body', async () => {
    const fetchImpl = vi.fn(async (..._args: any[]) => new Response('{}', { status: 201 }));
    const { adapter } = adapterWith(fetchImpl);
    await expect(adapter.addMemberToGuild(UID, 'user-access')).resolves.toEqual({
      joined: true,
      alreadyMember: false,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://discord.com/api/v10/guilds/guild-1/members/${UID}`);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bot bot-token');
    expect(JSON.parse(init.body as string)).toEqual({ access_token: 'user-access' });
  });

  it('204 means already a member', async () => {
    const { adapter } = adapterWith(vi.fn(async () => new Response(null, { status: 204 })));
    await expect(adapter.addMemberToGuild(UID, 't')).resolves.toEqual({ joined: false, alreadyMember: true });
  });

  it('maps 403 to bot_misconfigured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { adapter } = adapterWith(vi.fn(async () => json(403, { code: 50013 })));
    expect(await codeOf(adapter.addMemberToGuild(UID, 't'))).toBe('bot_misconfigured');
  });

  it('maps a banned user (40007) to banned', async () => {
    const { adapter } = adapterWith(vi.fn(async () => json(403, { code: 40007 })));
    expect(await codeOf(adapter.addMemberToGuild(UID, 't'))).toBe('banned');
  });

  it('maps max-servers (30001) to server_cap with the fallback invite in the message', async () => {
    const { adapter } = adapterWith(vi.fn(async () => json(400, { code: 30001 })));
    const err = (await adapter.addMemberToGuild(UID, 't').catch((e) => e)) as DiscordError;
    expect(err.code).toBe('server_cap');
    expect(err.message).toContain('discord.gg/ezesports');
  });

  it('retries once on a short 429 and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(429, { retry_after: 1 }, { 'retry-after': '1' }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    const { adapter, sleep } = adapterWith(fetchImpl);
    await expect(adapter.addMemberToGuild(UID, 't')).resolves.toMatchObject({ joined: true });
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces rate_limited when 429 persists or Retry-After is long', async () => {
    const persistent = vi.fn(async () => json(429, {}, { 'retry-after': '1' }));
    expect(await codeOf(adapterWith(persistent).adapter.addMemberToGuild(UID, 't'))).toBe('rate_limited');
    expect(persistent).toHaveBeenCalledTimes(2);

    const long = vi.fn(async () => json(429, {}, { 'retry-after': '60' }));
    const err = (await adapterWith(long).adapter.addMemberToGuild(UID, 't').catch((e) => e)) as DiscordError;
    expect(err.code).toBe('rate_limited');
    expect(err.retryAfterSeconds).toBe(60);
    expect(long).toHaveBeenCalledTimes(1);
  });

  it('maps 5xx and network errors to outage', async () => {
    expect(await codeOf(adapterWith(vi.fn(async () => json(503, {}))).adapter.addMemberToGuild(UID, 't'))).toBe('outage');
    const failing = vi.fn(async () => {
      throw new TypeError('network');
    });
    expect(await codeOf(adapterWith(failing).adapter.addMemberToGuild(UID, 't'))).toBe('outage');
  });

  it('rejects a non-snowflake user id without calling Discord', async () => {
    const fetchImpl = vi.fn();
    expect(await codeOf(adapterWith(fetchImpl).adapter.addMemberToGuild('not-an-id', 't'))).toBe('unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('DiscordRestAdapter other methods', () => {
  it('isMemberInGuild: 200 true, 404 false', async () => {
    expect(await adapterWith(vi.fn(async () => json(200, {}))).adapter.isMemberInGuild(UID)).toBe(true);
    expect(await adapterWith(vi.fn(async () => json(404, { code: 10007 }))).adapter.isMemberInGuild(UID)).toBe(false);
  });
});

describe('OAuth helpers', () => {
  it('builds the authorize URL with identify + guilds.join', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'http://localhost:3000/api/discord/callback', state: 's' })
    );
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe('identify guilds.join');
    expect(url.searchParams.get('state')).toBe('s');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/discord/callback');
  });

  it('exchanges a code and returns only the access token', async () => {
    const fetchImpl = vi.fn(async (..._a: any[]) => json(200, { access_token: 'tok', refresh_token: 'r' }));
    await expect(
      exchangeCode({ clientId: 'c', clientSecret: 's', redirectUri: 'u', code: 'abc', fetchImpl: fetchImpl as any })
    ).resolves.toEqual({ accessToken: 'tok' });
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1];
    expect(String(init.body)).toContain('grant_type=authorization_code');
  });

  it('maps a rejected code to invalid_code', async () => {
    const fetchImpl = vi.fn(async () => json(400, { error: 'invalid_grant' }));
    expect(
      await codeOf(exchangeCode({ clientId: 'c', clientSecret: 's', redirectUri: 'u', code: 'x', fetchImpl: fetchImpl as any }))
    ).toBe('invalid_code');
  });

  it('fetchCurrentUser returns id and username, and rejects malformed ids', async () => {
    await expect(
      fetchCurrentUser('t', vi.fn(async () => json(200, { id: UID, username: 'alex' })) as any)
    ).resolves.toEqual({ id: UID, username: 'alex' });
    expect(await codeOf(fetchCurrentUser('t', vi.fn(async () => json(200, { id: 'x', username: 'a' })) as any))).toBe(
      'unknown'
    );
  });
});
