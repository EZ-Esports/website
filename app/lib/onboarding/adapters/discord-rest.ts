import type { CommunityPlatformPort, GuildJoinResult } from '../ports';

export interface DiscordRestAdapterOptions {
  botToken?: string;
  guildId?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  mockInGuild?: boolean;
  isMock?: boolean;
}

/**
 * Discord REST API v10 Adapter.
 * Connects to Discord REST endpoints to manage guild members and role synchronization
 * without opening persistent WebSocket Gateway connections.
 * Automatically falls back to a development/mock mode when DISCORD_BOT_TOKEN is empty.
 */
export class DiscordRestAdapter implements CommunityPlatformPort {
  private readonly botToken: string;
  private readonly guildId: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly isMock: boolean;
  private readonly mockInGuild: boolean;

  constructor(options: DiscordRestAdapterOptions = {}) {
    this.botToken = options.botToken ?? process.env.DISCORD_BOT_TOKEN ?? '';
    this.guildId = options.guildId ?? process.env.DISCORD_GUILD_ID ?? '';
    this.baseUrl = options.baseUrl ?? 'https://discord.com/api/v10';
    this.fetchFn = options.fetchFn ?? fetch;
    this.isMock = options.isMock ?? !this.botToken;
    this.mockInGuild = options.mockInGuild ?? true;
  }

  /**
   * Adds a user to the official guild using their OAuth2 access token with `guilds.join` scope.
   * HTTP PUT /guilds/{guild.id}/members/{user.id}
   * 201 Created: user was successfully added.
   * 204 No Content: user was already a member of the guild.
   */
  async addMemberToGuild(discordUserId: string, accessToken: string): Promise<GuildJoinResult> {
    if (this.isMock) {
      return { joined: true, alreadyMember: false };
    }

    if (!this.guildId) {
      throw new Error('DISCORD_GUILD_ID is not configured');
    }

    const url = `${this.baseUrl}/guilds/${this.guildId}/members/${discordUserId}`;
    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (response.status === 201) {
      return { joined: true, alreadyMember: false };
    }

    if (response.status === 204) {
      return { joined: false, alreadyMember: true };
    }

    let errorDetail = '';
    try {
      const errBody = await response.json();
      errorDetail = errBody.message || JSON.stringify(errBody);
    } catch {
      errorDetail = response.statusText;
    }

    throw new Error(`Discord API error adding member (${response.status}): ${errorDetail}`);
  }

  /**
   * Checks if a Discord user is currently in the guild.
   * HTTP GET /guilds/{guild.id}/members/{user.id}
   * 200 OK: user is present.
   * 404 Not Found: user is not in the guild.
   */
  async isMemberInGuild(discordUserId: string): Promise<boolean> {
    if (this.isMock) {
      return this.mockInGuild;
    }

    if (!this.guildId) {
      throw new Error('DISCORD_GUILD_ID is not configured');
    }

    const url = `${this.baseUrl}/guilds/${this.guildId}/members/${discordUserId}`;
    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${this.botToken}`,
      },
    });

    if (response.status === 200) {
      return true;
    }

    if (response.status === 404) {
      return false;
    }

    let errorDetail = '';
    try {
      const errBody = await response.json();
      errorDetail = errBody.message || JSON.stringify(errBody);
    } catch {
      errorDetail = response.statusText;
    }

    throw new Error(`Discord API error checking guild membership (${response.status}): ${errorDetail}`);
  }

  /**
   * Updates assigned roles for a Discord guild member.
   * HTTP PATCH /guilds/{guild.id}/members/{user.id}
   */
  async syncMemberRoles(discordUserId: string, roleIds: string[]): Promise<void> {
    if (this.isMock) {
      return;
    }

    if (!this.guildId) {
      throw new Error('DISCORD_GUILD_ID is not configured');
    }

    const url = `${this.baseUrl}/guilds/${this.guildId}/members/${discordUserId}`;
    const response = await this.fetchFn(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles: roleIds }),
    });

    if (response.status === 200 || response.status === 204) {
      return;
    }

    let errorDetail = '';
    try {
      const errBody = await response.json();
      errorDetail = errBody.message || JSON.stringify(errBody);
    } catch {
      errorDetail = response.statusText;
    }

    throw new Error(`Discord API error syncing roles (${response.status}): ${errorDetail}`);
  }
}
