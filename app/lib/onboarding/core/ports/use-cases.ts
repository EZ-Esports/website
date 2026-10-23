import type { PlayerSubmissionDraft } from '../domain/types';
import type {
  ManagerInviteRecord,
  SchoolManagerRecord,
  RegisteredManagerAccountRecord,
} from './repository-port';

// ============================================================================
// HEXAGONAL ARCHITECTURE: INBOUND (USE CASE) PORTS
// ============================================================================

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

  getSchoolManagerInvites(schoolId: string): Promise<ManagerInviteRecord[]>;

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
