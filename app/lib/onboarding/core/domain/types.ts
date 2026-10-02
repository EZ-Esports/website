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

export interface SchoolPlayerPoolItem {
  playerId: string;
  memberId: string;
  gameId: string;
  gameName: string;
  gamerTag: string;
  rawGamerTag: string;
  trackerUrl: string | null;
  currentRosterId: string | null;
  currentRosterName: string | null;
  currentRole: CompetitiveRole | 'player' | null;
  isCaptain: boolean;
  isEnrolled: boolean;
}

export interface RosterPlayerItem {
  id: string;
  memberId: string;
  role: string | null;
  isCaptain: boolean;
  order: number;
  ign: string | null;
  inGuild: boolean;
  discordUsername: string | null;
  trackerUrl: string | null;
  isEnrolled: boolean;
  createdAt: Date;
}

export interface SchoolRosterWithPlayers {
  id: string;
  gameId: string;
  gameName: string;
  name: string;
  status: string;
  activePlayerCount: number;
  players: RosterPlayerItem[];
}

export interface SchoolManagerContext {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  managedGames: string[] | null;
  academicYear: string;
  isPrimaryContact: boolean;
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
