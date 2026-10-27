// ============================================================================
// HEXAGONAL ARCHITECTURE: EXTERNAL (DRIVEN) PORTS
// ============================================================================

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

export interface RoleSyncInput {
  /** Every role id this sync is allowed to touch. Roles outside this set are never added or removed. */
  managed: string[];
  /** The managed roles the member should hold afterwards. Ids not in `managed` are ignored. */
  desired: string[];
}

export interface RoleSyncOutcome {
  /** False when the user is not in the guild; nothing was changed. */
  inGuild: boolean;
  added: string[];
  removed: string[];
}

export interface CommunityPlatformPort {
  addMemberToGuild(discordUserId: string, accessToken: string): Promise<GuildJoinResult>;
  isMemberInGuild(discordUserId: string): Promise<boolean>;
  /** The member's current role ids, or null when they are not in the guild. */
  getMemberRoles(discordUserId: string): Promise<string[] | null>;
  addMemberRole(discordUserId: string, roleId: string): Promise<void>;
  removeMemberRole(discordUserId: string, roleId: string): Promise<void>;
  /**
   * Makes the member's MANAGED roles equal `desired` by adding and removing individual roles.
   * Every other role the member holds is left alone.
   */
  syncManagedRoles(discordUserId: string, input: RoleSyncInput): Promise<RoleSyncOutcome>;
}

export interface ManagerAuthUserResult {
  userId: string;
  email: string;
  isExisting: boolean;
}

export interface ManagerAuthPort {
  findOrCreateManagerUser(email: string): Promise<ManagerAuthUserResult>;
  sendPasswordResetEmail(email: string, redirectTo?: string): Promise<{ success: boolean; error?: string }>;
}
