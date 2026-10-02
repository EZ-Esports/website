import type {
  CompetitiveRole,
  SchoolPlayerPoolItem,
  SchoolRosterWithPlayers,
  PlayerSubmissionDraft,
} from '../domain/types';

// ============================================================================
// HEXAGONAL ARCHITECTURE: REPOSITORY (DRIVEN) PORT
// ============================================================================

export interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

export interface GameRecord {
  id: string;
  name: string;
  slug: string;
  platform?: string | null;
}

export interface PlayerInviteRecord {
  id: string;
  schoolId: string;
  gameId: string | null;
  role: string;
  tokenHash: string;
  intendedFirstName: string;
  intendedLastName: string;
  invitedByUserId: string;
  status: string;
  submissionDraft: PlayerSubmissionDraft | null;
  expiresAt: Date | string | null;
  submittedAt: Date | string | null;
  reviewedAt: Date | string | null;
  rejectionReason: string | null;
  createdAt: Date | string;
}

export interface SchoolManagerRecord {
  id: string;
  schoolId: string;
  userId: string;
  memberId: string | null;
  managedGames: string[] | null;
  academicYear: string;
  isPrimaryContact: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisteredManagerAccountRecord {
  userId: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  schools: string[];
}

export interface OnboardingRepositoryPort {
  // School & Game queries
  findSchoolById(schoolId: string): Promise<SchoolRecord | null>;
  findSchoolBySlug(slug: string): Promise<SchoolRecord | null>;
  findGameById(gameId: string): Promise<GameRecord | null>;
  findGameBySlug(slug: string): Promise<GameRecord | null>;

  // Roster & Player queries
  findSchoolRosters(schoolId: string, gameIds?: string[] | null): Promise<SchoolRosterWithPlayers[]>;
  findSchoolPlayerPool(schoolId: string, gameId?: string): Promise<SchoolPlayerPoolItem[]>;
  findRosterById(rosterId: string): Promise<{ id: string; schoolId: string; gameId: string; name: string } | null>;

  // Invite operations
  findInviteByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null>;
  findInviteById(inviteId: string): Promise<PlayerInviteRecord | null>;
  createPlayerInvite(params: {
    schoolId: string;
    gameId: string;
    tokenHash: string;
    intendedFirstName: string;
    intendedLastName: string;
    invitedByUserId: string;
    expiresAt: Date;
  }): Promise<PlayerInviteRecord>;
  updateInviteDraft(inviteId: string, draft: Partial<PlayerSubmissionDraft>): Promise<void>;
  submitInvite(inviteId: string, finalDraft: PlayerSubmissionDraft): Promise<void>;
  listSchoolInvites(schoolId: string, gameId?: string): Promise<PlayerInviteRecord[]>;
  listPendingSubmissions(schoolId: string, gameId?: string): Promise<PlayerInviteRecord[]>;
  revokePlayerInvite(inviteId: string): Promise<void>;

  // Approval & Roster mutations
  approveInviteAndEnroll(params: {
    inviteId: string;
    schoolId: string;
    gameId: string;
    draft: PlayerSubmissionDraft;
    targetRosterId?: string | null;
    competitiveRole: CompetitiveRole;
  }): Promise<{
    memberId: string;
    playerId?: string;
    demographicsId: string;
    identityId?: string;
  }>;

  enrollPlayerToRoster(params: {
    rosterId: string;
    schoolId: string;
    gameId: string;
    memberId: string;
    ign?: string | null;
    role: CompetitiveRole;
  }): Promise<{ playerId: string; rosterId: string; memberId: string; role: string; isCaptain: boolean }>;

  updateRosterPlayerRole(params: {
    rosterId: string;
    playerId: string;
    role: CompetitiveRole;
  }): Promise<{ success: boolean }>;

  removePlayerFromRoster(params: {
    rosterId: string;
    playerId: string;
  }): Promise<{ success: boolean }>;

  emergencySwapSub(params: {
    rosterId: string;
    currentStarterId: string;
    substitutePlayerId: string;
  }): Promise<{ success: boolean }>;

  // Manager provisioning
  findSchoolManagers(schoolId: string): Promise<any[]>;
  findRegisteredManagers(searchQuery?: string): Promise<RegisteredManagerAccountRecord[]>;
  createOrUpdateSchoolManager(params: {
    schoolId: string;
    userId: string;
    memberId?: string | null;
    academicYear: string;
    managedGames?: string[] | null;
    isPrimaryContact: boolean;
  }): Promise<SchoolManagerRecord>;
  removeSchoolManager(managerId: string): Promise<SchoolManagerRecord | null>;
  findManagerById(managerId: string): Promise<SchoolManagerRecord | null>;
  resolveStaffUserId(email: string): Promise<string | null>;

  createManagerInvite(params: {
    schoolId: string;
    tokenHash: string;
    intendedFirstName: string;
    intendedLastName: string;
    invitedByUserId: string;
    expiresAt: Date;
    draft?: Record<string, unknown>;
  }): Promise<PlayerInviteRecord>;
  listSchoolManagerInvites(schoolId: string): Promise<PlayerInviteRecord[]>;
  revokeManagerInvite(inviteId: string): Promise<void>;

  // Audit
  writeStaffAuditLog(params: {
    event: string;
    userId: string;
    email: string;
    details: Record<string, unknown>;
  }): Promise<void>;
}
