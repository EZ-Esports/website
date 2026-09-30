export interface ResolvedGameIdentity {
  gameId: string;
  displayName: string;
  rawIdentifier: string;
  isVerified: boolean;
  trackerUrl?: string;
}

export interface GameIdentityPort {
  resolveIdentity(gameSlug: string, identifier: string): Promise<ResolvedGameIdentity>;
}

export interface GuildJoinResult {
  joined: boolean;
  alreadyMember: boolean;
}

export interface CommunityPlatformPort {
  addMemberToGuild(discordUserId: string, accessToken: string): Promise<GuildJoinResult>;
  isMemberInGuild(discordUserId: string): Promise<boolean>;
  syncMemberRoles(discordUserId: string, roleIds: string[]): Promise<void>;
}
