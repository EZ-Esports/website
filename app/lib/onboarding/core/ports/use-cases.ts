import type {
  CompetitiveRole,
  SchoolManagerContext,
  SchoolPlayerPoolItem,
  SchoolRosterWithPlayers,
  PlayerSubmissionDraft,
} from '../domain/types';
import type {
  PlayerInviteRecord,
  SchoolManagerRecord,
  RegisteredManagerAccountRecord,
} from './repository-port';

// ============================================================================
// HEXAGONAL ARCHITECTURE: INBOUND (USE CASE) PORTS
// ============================================================================

export interface SchoolManagerPortalUseCase {
  getSchoolPortalData(context: SchoolManagerContext): Promise<{
    schoolId: string;
    schoolName: string;
    academicYear: string;
    rosters: SchoolRosterWithPlayers[];
    pendingInvites: PlayerInviteRecord[];
    pendingSubmissions: PlayerInviteRecord[];
  }>;

  getSchoolPlayerPool(
    context: SchoolManagerContext,
    gameId?: string
  ): Promise<SchoolPlayerPoolItem[]>;

  createPlayerInvite(
    context: SchoolManagerContext,
    params: {
      gameId: string;
      intendedFirstName: string;
      intendedLastName: string;
    }
  ): Promise<{
    success: boolean;
    token?: string;
    inviteUrl?: string;
    invite?: PlayerInviteRecord;
    error?: string;
  }>;

  reviewPlayerInvite(
    context: SchoolManagerContext,
    params: {
      inviteId: string;
      decision: 'approved' | 'rejected';
      rejectionReason?: string;
      targetRosterId?: string | null;
      competitiveRole?: CompetitiveRole;
    }
  ): Promise<{
    success: boolean;
    error?: string;
    enrolledPlayer?: {
      playerId: string;
      rosterId: string;
      memberId: string;
      role: string;
      isCaptain: boolean;
    };
  }>;

  enrollPlayerToRoster(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      memberId: string;
      ign?: string | null;
      role?: CompetitiveRole;
    }
  ): Promise<{
    success: boolean;
    error?: string;
    enrolled?: {
      playerId: string;
      rosterId: string;
      memberId: string;
      role: string;
      isCaptain: boolean;
    };
  }>;

  removePlayerFromRoster(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      playerId: string;
    }
  ): Promise<{ success: boolean; error?: string }>;

  updateRosterPlayerRole(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      playerId: string;
      role: CompetitiveRole;
    }
  ): Promise<{ success: boolean; error?: string }>;

  emergencySwapSub(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      currentStarterId: string;
      substitutePlayerId: string;
    }
  ): Promise<{ success: boolean; error?: string }>;

  revokePlayerInvite(
    context: SchoolManagerContext,
    inviteId: string
  ): Promise<{ success: boolean; error?: string }>;
}

export interface CandidateOnboardingUseCase {
  validateInviteToken(params: {
    token: string;
    schoolSlug?: string;
    gameSlug?: string;
  }): Promise<{
    valid: boolean;
    schoolName?: string;
    gameName?: string;
    intendedName?: string;
    existingDraft?: Partial<PlayerSubmissionDraft> | null;
    error?: string;
  }>;

  saveOnboardingDraft(params: {
    token: string;
    step: number;
    draftData: Partial<PlayerSubmissionDraft>;
  }): Promise<{ success: boolean; error?: string }>;

  submitPlayerOnboarding(params: {
    token: string;
    submissionData: PlayerSubmissionDraft;
  }): Promise<{ success: boolean; error?: string; message?: string }>;
}

export interface StaffManagerProvisioningUseCase {
  provisionSchoolManager(
    actor: { id: string; email: string },
    params: {
      schoolId: string;
      email: string;
      userId?: string;
      managedGames?: string[];
      isPrimaryContact?: boolean;
      academicYear?: string;
    }
  ): Promise<{
    success: boolean;
    error?: string;
    manager?: SchoolManagerRecord;
    message?: string;
  }>;

  removeSchoolManager(
    actor: { id: string; email: string },
    params: { managerId: string }
  ): Promise<{
    success: boolean;
    error?: string;
    manager?: SchoolManagerRecord;
    message?: string;
  }>;

  getSchoolManagers(
    schoolId: string
  ): Promise<any[]>;

  generateManagerInvite(
    actor: { id: string; email: string },
    params: {
      schoolId: string;
      firstName: string;
      lastName: string;
      email?: string;
      academicYear?: string;
      managedGames?: string[] | null;
      isPrimaryContact?: boolean;
    }
  ): Promise<{
    success: boolean;
    token?: string;
    inviteUrl?: string;
    inviteId?: string;
    error?: string;
  }>;

  getSchoolManagerInvites(schoolId: string): Promise<PlayerInviteRecord[]>;

  revokeManagerInvite(
    actor: { id: string; email: string },
    inviteId: string
  ): Promise<{ success: boolean; error?: string }>;

  getRegisteredManagers(
    searchQuery?: string
  ): Promise<RegisteredManagerAccountRecord[]>;

  assignExistingManager(
    actor: { id: string; email: string },
    params: {
      schoolId: string;
      userId?: string;
      memberId?: string;
      email?: string;
      academicYear?: string;
      managedGames?: string[] | null;
      isPrimaryContact?: boolean;
    }
  ): Promise<{
    success: boolean;
    error?: string;
    manager?: SchoolManagerRecord;
    message?: string;
  }>;
}
