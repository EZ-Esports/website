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

/**
 * Why the bot cannot be trusted to assign the tier roles. The sync fails closed: any reason other
 * than `ok` means no role is added or removed anywhere in that run.
 */
export type TierPreflightReason =
  | 'missing_manage_roles'
  | 'role_not_below_bot'
  | 'role_missing'
  | 'role_is_managed'
  | 'preflight_failed';

export type TierPreflightResult = { ok: true } | { ok: false; reason: TierPreflightReason };

export interface CommunityPlatformPort {
  /**
   * Verifies, without changing anything, that the bot can assign EVERY one of `managedRoleIds`:
   * it holds Administrator or Manage Roles, each role exists in the guild, none is an integration
   * (`managed`) role, and each sits strictly below the bot's highest role. Never throws; a check
   * that cannot complete reports `preflight_failed`.
   */
  checkTierRolesAssignable(managedRoleIds: string[]): Promise<TierPreflightResult>;
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
