// ============================================================================
// HEXAGONAL ARCHITECTURE PORTS & INTERFACES
// ============================================================================

export * from './core/domain/types';
export * from './core/ports/external-ports';
export * from './core/ports/repository-port';
export * from './core/ports/use-cases';

// Backward-compatible generic aliases
export interface CandidateOnboardingPort<
  TValidateParams = any,
  TValidateResult = any,
  TSubmitParams = any,
  TSubmitResult = any
> {
  validateInviteToken(params: TValidateParams): Promise<TValidateResult>;
  submitPlayerOnboarding(params: TSubmitParams): Promise<TSubmitResult>;
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
