import type { CommunityPlatformPort, GuildJoinResult } from '../core/ports/external-ports';

/**
 * Stateless Discord REST client for the onboarding wizard. Plain `fetch` against API v10:
 * no gateway socket (unsuitable for serverless) and no SDK dependency.
 *
 * The student's OAuth access token is only ever held in memory for the duration of the
 * callback request: it is passed to `addMemberToGuild` and then dropped. It is never
 * persisted, logged or put in a cookie.
 */

export const DISCORD_API_BASE = 'https://discord.com/api/v10';
export const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
export const DISCORD_OAUTH_SCOPES = 'identify guilds.join';
/** Public fallback invite shown when the automatic join cannot complete. */
export const DISCORD_FALLBACK_INVITE = 'discord.gg/ezesports';

const SNOWFLAKE_REGEX = /^\d{17,20}$/;
export function isDiscordSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_REGEX.test(value);
}

export type DiscordFailureCode =
  | 'consent_denied'
  | 'state_invalid'
  | 'invalid_code'
  | 'server_cap'
  | 'banned'
  | 'bot_misconfigured'
  | 'rate_limited'
  | 'outage'
  | 'unknown';

/** A failure whose `message` is safe and readable to show to a student. */
export class DiscordError extends Error {
  readonly code: DiscordFailureCode;
  readonly retryAfterSeconds?: number;

  constructor(code: DiscordFailureCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'DiscordError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Student-facing copy per failure code, shared by the callback route and the wizard. */
export const DISCORD_FAILURE_MESSAGES: Record<DiscordFailureCode, string> = {
  consent_denied:
    'Discord access was not approved. EZ Esports needs to confirm your Discord account to continue. Press "Connect Discord" to try again.',
  state_invalid:
    'That Discord sign-in link was invalid or had expired, so nothing was connected. Please press "Connect Discord" to start again from this page.',
  invalid_code: 'Discord could not confirm that sign-in. Please press "Connect Discord" to try again.',
  server_cap: `Your Discord account is already in the maximum number of servers, so we could not add you automatically. Leave a server you no longer use, or join manually at ${DISCORD_FALLBACK_INVITE}, then press "Connect Discord" again.`,
  banned: 'This Discord account cannot join the EZ Esports server. Please contact your school manager.',
  bot_misconfigured:
    'We could not add you to the EZ Esports Discord server because of a problem on our side. Please tell your school manager or an EZ Esports staff member.',
  rate_limited: 'Discord is busy right now. Please wait a minute and press "Connect Discord" again.',
  outage: 'Discord is not responding right now. Please try again in a few minutes.',
  unknown: 'Something went wrong while connecting Discord. Please try again.',
};

export function discordFailure(code: DiscordFailureCode, retryAfterSeconds?: number): DiscordError {
  return new DiscordError(code, DISCORD_FAILURE_MESSAGES[code], retryAfterSeconds);
}

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  botToken: string;
  guildId: string;
}

/** Reads the Discord env vars. Names only are referenced in errors, never values. */
export function getDiscordConfig(env: NodeJS.ProcessEnv = process.env): DiscordConfig {
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const botToken = env.DISCORD_BOT_TOKEN;
  const guildId = env.DISCORD_GUILD_ID;
  if (!clientId || !clientSecret || !botToken || !guildId) {
    console.error(
      'Discord onboarding is not configured: set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN and DISCORD_GUILD_ID.'
    );
    throw discordFailure('bot_misconfigured');
  }
  return { clientId, clientSecret, botToken, guildId };
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', DISCORD_OAUTH_SCOPES);
  url.searchParams.set('state', params.state);
  // Always re-show consent so a student on a shared school device picks the right account.
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

type FetchLike = typeof fetch;

async function safeFetch(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw discordFailure('outage');
  }
}

/** Exchanges an authorization code for the student's access token (held in memory only). */
export async function exchangeCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  fetchImpl?: FetchLike;
}): Promise<{ accessToken: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const res = await safeFetch(fetchImpl, `${DISCORD_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  if (res.status === 429) throw discordFailure('rate_limited', parseRetryAfter(res));
  if (res.status >= 500) throw discordFailure('outage');
  if (res.status === 400) throw discordFailure('invalid_code');
  if (res.status === 401) throw discordFailure('bot_misconfigured');
  if (!res.ok) throw discordFailure('unknown');

  const body = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!body || typeof body.access_token !== 'string' || !body.access_token) {
    throw discordFailure('unknown');
  }
  return { accessToken: body.access_token };
}

export interface DiscordUser {
  id: string;
  username: string;
}

/** GET /users/@me with the student's token; returns the immutable snowflake and handle. */
export async function fetchCurrentUser(
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<DiscordUser> {
  const res = await safeFetch(fetchImpl, `${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 429) throw discordFailure('rate_limited', parseRetryAfter(res));
  if (res.status >= 500) throw discordFailure('outage');
  if (res.status === 401 || res.status === 403) throw discordFailure('invalid_code');
  if (!res.ok) throw discordFailure('unknown');

  const body = (await res.json().catch(() => null)) as { id?: unknown; username?: unknown } | null;
  if (!body || !isDiscordSnowflake(body.id) || typeof body.username !== 'string' || !body.username) {
    throw discordFailure('unknown');
  }
  return { id: body.id, username: body.username };
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Longest Retry-After we will wait out inside a single serverless request. */
const MAX_INLINE_RETRY_SECONDS = 3;

export interface DiscordRestAdapterOptions {
  botToken: string;
  guildId: string;
  fetchImpl?: FetchLike;
  /** Injectable so tests do not really sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export class DiscordRestAdapter implements CommunityPlatformPort {
  private readonly botToken: string;
  private readonly guildId: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: DiscordRestAdapterOptions) {
    this.botToken = options.botToken;
    this.guildId = options.guildId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): DiscordRestAdapter {
    const { botToken, guildId } = getDiscordConfig(env);
    return new DiscordRestAdapter({ botToken, guildId });
  }

  /** Bot request that honours a short 429 Retry-After once, then surfaces a retryable error. */
  private async botRequest(path: string, init: RequestInit): Promise<Response> {
    const run = () =>
      safeFetch(this.fetchImpl, `${DISCORD_API_BASE}${path}`, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bot ${this.botToken}`,
        },
      });

    let res = await run();
    if (res.status === 429) {
      const retryAfter = parseRetryAfter(res);
      if (retryAfter !== undefined && retryAfter <= MAX_INLINE_RETRY_SECONDS) {
        await this.sleep(Math.ceil(retryAfter * 1000));
        res = await run();
      }
      if (res.status === 429) throw discordFailure('rate_limited', parseRetryAfter(res));
    }
    return res;
  }

  async addMemberToGuild(discordUserId: string, accessToken: string): Promise<GuildJoinResult> {
    if (!isDiscordSnowflake(discordUserId)) throw discordFailure('unknown');

    const res = await this.botRequest(`/guilds/${this.guildId}/members/${discordUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (res.status === 201) return { joined: true, alreadyMember: false };
    if (res.status === 204) return { joined: false, alreadyMember: true };

    const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
    const apiCode = typeof body?.code === 'number' ? body.code : undefined;

    if (res.status >= 500) throw discordFailure('outage');
    if (apiCode === 30001) throw discordFailure('server_cap');
    if (apiCode === 40007) throw discordFailure('banned');
    // 401/403/404: bad bot token, bot not in the guild, or missing Create Instant Invite.
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      console.error(`Discord guild join rejected (HTTP ${res.status}, code ${apiCode ?? 'n/a'}); check bot token, guild id and bot permissions.`);
      throw discordFailure('bot_misconfigured');
    }
    throw discordFailure('unknown');
  }

  async isMemberInGuild(discordUserId: string): Promise<boolean> {
    if (!isDiscordSnowflake(discordUserId)) return false;
    const res = await this.botRequest(`/guilds/${this.guildId}/members/${discordUserId}`, {
      method: 'GET',
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    if (res.status >= 500) throw discordFailure('outage');
    if (res.status === 401 || res.status === 403) throw discordFailure('bot_misconfigured');
    throw discordFailure('unknown');
  }

  async syncMemberRoles(_discordUserId: string, _roleIds: string[]): Promise<void> {
    throw new Error('DiscordRestAdapter.syncMemberRoles is not implemented: role assignment is out of scope for Discord OAuth onboarding.');
  }
}
