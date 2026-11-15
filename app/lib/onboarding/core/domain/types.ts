// ============================================================================
// HEXAGONAL ARCHITECTURE: CORE DOMAIN TYPES
// ============================================================================

export type CompetitiveRole = 'starter' | 'sub' | 'captain';

export type InviteStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';

export interface PlayerIdentityData {
  provider: 'riot' | 'steam' | 'discord' | 'epic';
  providerUserId: string;
  providerUsername: string;
  inGuild?: boolean;
  profileData?: Record<string, unknown>;
}

export interface PlayerSubmissionDraft {
  schoolId: string;
  gameId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  inGuild?: boolean;
  step?: number;
  identities?: Record<string, PlayerIdentityData>;
  [key: string]: unknown;
}
