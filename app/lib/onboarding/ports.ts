// ============================================================================
// HEXAGONAL ARCHITECTURE PORTS: ONBOARDING & TENANCY DOMAIN
// ============================================================================

// --- OUTBOUND (DRIVEN) INFRASTRUCTURE PORTS ---

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

// --- INBOUND (DRIVING) APPLICATION USE CASE PORTS ---

export interface CandidateOnboardingPort<
  TValidateParams = any,
  TValidateResult = any,
  TSubmitParams = any,
  TSubmitResult = any
> {
  validateInviteToken(params: TValidateParams): Promise<TValidateResult>;
  submitPlayerOnboarding(params: TSubmitParams): Promise<TSubmitResult>;
}

export interface SchoolManagerPortalPort<
  TGenerateParams = any,
  TGenerateResult = any,
  TApproveParams = any,
  TApproveResult = any,
  TRejectParams = any,
  TRejectResult = any
> {
  generatePlayerInvite(params: TGenerateParams): Promise<TGenerateResult>;
  getSchoolInvites(schoolId: string, gameId?: string): Promise<any[]>;
  getPendingSubmissions(schoolId: string, gameId?: string): Promise<any[]>;
  approveSubmissionAndAssignRoster(params: TApproveParams): Promise<TApproveResult>;
  rejectSubmission(params: TRejectParams): Promise<TRejectResult>;
  revokePlayerInvite(inviteId: string): Promise<{ success: boolean; error?: string }>;
}

export interface StaffManagerProvisioningPort<
  TInviteParams = any,
  TInviteResult = any,
  TAssignParams = any,
  TAssignResult = any
> {
  generateManagerInvite(params: TInviteParams): Promise<TInviteResult>;
  getSchoolManagerInvites(schoolId: string): Promise<any[]>;
  revokeManagerInvite(inviteId: string): Promise<{ success: boolean; error?: string }>;
  getRegisteredManagers(searchQuery?: string): Promise<any[]>;
  assignExistingManager(params: TAssignParams): Promise<TAssignResult>;
  removeSchoolManager(params: { managerId: string }): Promise<{ success: boolean; error?: string }>;
}

export interface SchoolManagerContextPort<TContext = any> {
  getSchoolManagerContext(schoolId?: string): Promise<TContext | null>;
  assertManagerForSchool(schoolId: string, gameId?: string): Promise<TContext>;
}

