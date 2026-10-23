import type { PlayerSubmissionDraft } from '../domain/types';

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
  gameId: string;
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

export interface ManagerInviteRecord {
  id: string;
  schoolId: string;
  tokenHash: string;
  intendedFirstName: string;
  intendedLastName: string;
  invitedByUserId: string;
  status: string;
  submissionDraft: Record<string, unknown> | null;
  expiresAt: Date | string | null;
  submittedAt: Date | string | null;
  reviewedAt: Date | string | null;
  rejectionReason: string | null;
  memberId: string | null;
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
  tourCompletedAt: Date | null;
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

  // Invite operations
  findInviteByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null>;
  updateInviteDraft(inviteId: string, draft: Partial<PlayerSubmissionDraft>): Promise<void>;
  submitInvite(inviteId: string, finalDraft: PlayerSubmissionDraft): Promise<void>;

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
  }): Promise<ManagerInviteRecord>;
  listSchoolManagerInvites(schoolId: string): Promise<ManagerInviteRecord[]>;
  revokeManagerInvite(inviteId: string): Promise<void>;

  // Audit
  writeStaffAuditLog(params: {
    event: string;
    userId: string;
    email: string;
    details: Record<string, unknown>;
  }): Promise<void>;
}
