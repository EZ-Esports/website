// ============================================================================
// HEXAGONAL ARCHITECTURE: CORE DOMAIN TYPES
// ============================================================================

export type CompetitiveRole = 'starter' | 'sub' | 'captain';

export type InviteStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';

export interface DemographicSurveyData {
  legalFirstName: string;
  legalLastName: string;
  birthDate: string;
  gender: string;
  race: string;
  ethnicity?: string;
  countryOfBirth?: string;
  parentsCountryOfBirth?: string;
  primaryLanguageAtHome?: string;
  isFreeOrReducedLunch?: boolean;
  isFirstGenCollege?: boolean;
  doePetitionConsent?: boolean;
  surveyDetails?: Record<string, unknown>;
}

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
  demographics?: DemographicSurveyData;
  identities?: Record<string, PlayerIdentityData>;
  [key: string]: unknown;
}
