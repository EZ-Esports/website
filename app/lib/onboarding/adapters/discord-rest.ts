import type {
  CommunityPlatformPort,
  GuildJoinResult,
  RoleSyncInput,
  RoleSyncOutcome,
  TierPreflightReason,
  TierPreflightResult,
} from '../core/ports/external-ports';

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
  | 'role_not_found'
  | 'member_not_found'
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
  role_not_found:
    'A Discord tier role in DISCORD_TIER_ROLES does not exist in the server. Check the role ids.',
  member_not_found: 'That Discord user is not in the EZ Esports server.',
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
  /** Injectable clock for the preflight cache. */
  now?: () => number;
}

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_ROLES = BigInt(0x10000000);

/** A passing preflight is trusted for this long; a failing one is re-checked sooner so a fix shows quickly. */
export const PREFLIGHT_SUCCESS_TTL_MS = 5 * 60_000;
export const PREFLIGHT_FAILURE_TTL_MS = 60_000;

const preflightCache = new Map<string, { result: TierPreflightResult; expiresAt: number }>();

/** Forgets cached preflight results for a guild (all guilds when omitted). */
export function invalidateTierPreflightCache(guildId?: string): void {
  if (guildId === undefined) {
    preflightCache.clear();
    return;
  }
  for (const key of [...preflightCache.keys()]) if (key.startsWith(`${guildId}|`)) preflightCache.delete(key);
}

export class DiscordRestAdapter implements CommunityPlatformPort {
  private readonly botToken: string;
  private readonly guildId: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(options: DiscordRestAdapterOptions) {
    this.botToken = options.botToken;
    this.guildId = options.guildId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = options.now ?? Date.now;
  }

  async checkTierRolesAssignable(managedRoleIds: string[]): Promise<TierPreflightResult> {
    const key = `${this.guildId}|${[...managedRoleIds].sort().join(',')}`;
    const hit = preflightCache.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.result;

    let result: TierPreflightResult;
    try {
      result = await this.runPreflight(managedRoleIds);
    } catch {
      // Network, 5xx, 429, 401/403 or an unreadable answer: we cannot prove the roles are
      // assignable, so assign nothing.
      result = { ok: false, reason: 'preflight_failed' };
    }
    preflightCache.set(key, {
      result,
      expiresAt: this.now() + (result.ok ? PREFLIGHT_SUCCESS_TTL_MS : PREFLIGHT_FAILURE_TTL_MS),
    });
    return result;
  }

  private async runPreflight(managedRoleIds: string[]): Promise<TierPreflightResult> {
    const fail = (reason: TierPreflightReason): TierPreflightResult => ({ ok: false, reason });
    if (managedRoleIds.length === 0 || !managedRoleIds.every(isDiscordSnowflake)) return fail('role_missing');

    const me = await this.botRequest('/users/@me', { method: 'GET' });
    const meBody = me.status === 200 ? ((await me.json().catch(() => null)) as { id?: unknown } | null) : null;
    if (!meBody || !isDiscordSnowflake(meBody.id)) return fail('preflight_failed');
    const botId = meBody.id;

    const rolesRes = await this.botRequest(`/guilds/${this.guildId}/roles`, { method: 'GET' });
    const rolesBody = rolesRes.status === 200 ? ((await rolesRes.json().catch(() => null)) as unknown) : null;
    if (!Array.isArray(rolesBody)) return fail('preflight_failed');
    const guildRoles = new Map<string, { position: number; permissions: bigint; managed: boolean }>();
    for (const r of rolesBody as Array<Record<string, unknown>>) {
      if (!isDiscordSnowflake(r.id) || typeof r.position !== 'number' || typeof r.permissions !== 'string') {
        return fail('preflight_failed');
      }
      guildRoles.set(r.id, { position: r.position, permissions: BigInt(r.permissions), managed: r.managed === true });
    }

    const memberRes = await this.botRequest(`/guilds/${this.guildId}/members/${botId}`, { method: 'GET' });
    const memberBody = memberRes.status === 200 ? ((await memberRes.json().catch(() => null)) as { roles?: unknown } | null) : null;
    if (!memberBody || !Array.isArray(memberBody.roles)) return fail('preflight_failed');
    const botRoleIds = memberBody.roles.filter(isDiscordSnowflake);

    // @everyone shares the guild's id and applies to every member.
    let permissions = guildRoles.get(this.guildId)?.permissions ?? BigInt(0);
    let highest = 0;
    for (const id of botRoleIds) {
      const role = guildRoles.get(id);
      if (!role) continue;
      permissions |= role.permissions;
      highest = Math.max(highest, role.position);
    }
    if ((permissions & ADMINISTRATOR) === BigInt(0) && (permissions & MANAGE_ROLES) === BigInt(0)) {
      return fail('missing_manage_roles');
    }

    for (const id of managedRoleIds) {
      const role = guildRoles.get(id);
      if (!role) return fail('role_missing');
      if (role.managed) return fail('role_is_managed');
      if (role.position >= highest) return fail('role_not_below_bot');
    }
    return { ok: true };
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

  async getMemberRoles(discordUserId: string): Promise<string[] | null> {
    if (!isDiscordSnowflake(discordUserId)) throw discordFailure('unknown');
    const res = await this.botRequest(`/guilds/${this.guildId}/members/${discordUserId}`, { method: 'GET' });
    if (res.status === 200) {
      const body = (await res.json().catch(() => null)) as { roles?: unknown } | null;
      if (!body || !Array.isArray(body.roles)) throw discordFailure('unknown');
      return body.roles.filter(isDiscordSnowflake);
    }
    if (res.status === 404) {
      const apiCode = await apiCodeOf(res);
      // 10004 is "Unknown Guild": a wrong DISCORD_GUILD_ID, not a user who is absent.
      if (apiCode === 10004) throw discordFailure('bot_misconfigured');
      return null;
    }
    this.throwForStatus(res.status);
  }

  async addMemberRole(discordUserId: string, roleId: string): Promise<void> {
    await this.changeRole('PUT', discordUserId, roleId);
  }

  async removeMemberRole(discordUserId: string, roleId: string): Promise<void> {
    await this.changeRole('DELETE', discordUserId, roleId);
  }

  /**
   * Adds or removes ONE role through the per-role endpoints. The PATCH-members `roles` array
   * overwrites everything the member has and would erase roles staff assigned by hand, so this
   * adapter never uses it.
   */
  private async changeRole(method: 'PUT' | 'DELETE', discordUserId: string, roleId: string): Promise<void> {
    if (!isDiscordSnowflake(discordUserId) || !isDiscordSnowflake(roleId)) throw discordFailure('unknown');
    const res = await this.botRequest(`/guilds/${this.guildId}/members/${discordUserId}/roles/${roleId}`, {
      method,
      headers: { 'X-Audit-Log-Reason': ROLE_SYNC_AUDIT_REASON },
    });
    if (res.status === 204 || res.status === 200) return;
    if (res.status === 404) {
      // Attribute by Discord's own error code. Anything unrecognised (including a body that is not
      // JSON, such as a proxy page) is "unknown" rather than blamed on the role configuration.
      const apiCode = await apiCodeOf(res);
      if (apiCode === 10007 || apiCode === 10013) throw discordFailure('member_not_found');
      if (apiCode === 10011) throw discordFailure('role_not_found');
      if (apiCode === 10004) throw discordFailure('bot_misconfigured');
      throw discordFailure('unknown');
    }
    this.throwForStatus(res.status);
  }

  async syncManagedRoles(discordUserId: string, input: RoleSyncInput): Promise<RoleSyncOutcome> {
    const { toAdd, toRemove, current } = await this.planManagedRoles(discordUserId, input);
    if (current === null) return { inGuild: false, added: [], removed: [] };

    const added: string[] = [];
    const removed: string[] = [];
    try {
      // Add before remove so a move between tiers never leaves the member with neither role.
      for (const id of toAdd) {
        await this.addMemberRole(discordUserId, id);
        added.push(id);
      }
      for (const id of toRemove) {
        await this.removeMemberRole(discordUserId, id);
        removed.push(id);
      }
    } catch (error) {
      // They left the server between the read and the write: nothing left to sync.
      if (error instanceof DiscordError && error.code === 'member_not_found') {
        return { inGuild: false, added: [], removed: [] };
      }
      throw error;
    }
    return { inGuild: true, added, removed };
  }

  /** Reads the member's roles and works out what a sync would change, without changing anything. */
  async planManagedRoles(
    discordUserId: string,
    input: RoleSyncInput
  ): Promise<{ current: string[] | null; toAdd: string[]; toRemove: string[] }> {
    const current = await this.getMemberRoles(discordUserId);
    if (current === null) return { current: null, toAdd: [], toRemove: [] };
    return { current, ...planRoleChanges(current, input) };
  }

  private throwForStatus(status: number): never {
    if (status >= 500) throw discordFailure('outage');
    if (status === 401 || status === 403) {
      // The bot lacks Manage Roles, or its highest role sits below the tier role it must assign.
      // Whatever the preflight cached about this guild is now known to be wrong.
      invalidateTierPreflightCache(this.guildId);
      console.error(`Discord role request rejected (HTTP ${status}); the bot needs Manage Roles and a role above the tier roles.`);
      throw discordFailure('bot_misconfigured');
    }
    throw discordFailure('unknown');
  }
}

/** Shown in the server's audit log next to every role change the sync makes. ASCII only: it travels in an HTTP header. */
export const ROLE_SYNC_AUDIT_REASON = 'EZ Esports roster sync';

/**
 * The only place the add/remove sets are decided. A role is touched only if it is in `managed`:
 * `desired` is clipped to it, and only managed roles the member currently holds can be removed.
 */
export function planRoleChanges(
  current: string[],
  input: RoleSyncInput
): { toAdd: string[]; toRemove: string[] } {
  const managed = new Set(input.managed.filter(isDiscordSnowflake));
  const desired = new Set(input.desired.filter((id) => managed.has(id)));
  const held = new Set(current);
  return {
    toAdd: [...desired].filter((id) => !held.has(id)),
    toRemove: [...held].filter((id) => managed.has(id) && !desired.has(id)),
  };
}

async function apiCodeOf(res: Response): Promise<number | undefined> {
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === 'number' ? body.code : undefined;
}
