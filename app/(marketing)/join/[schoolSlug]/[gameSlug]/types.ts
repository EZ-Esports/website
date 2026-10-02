export interface InviteData {
  inviteId: string;
  role?: 'player' | 'manager';
  intendedFirstName: string;
  intendedLastName: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  gameId: string | null;
  gameName: string;
  gameSlug: string;
  submissionDraft: Record<string, any> | null;
  expiresAt: Date;
}

export interface WizardFormData {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  password?: string;
  graduationYear: number;
  discordUsername: string;
  discordJoinedConfirmed: boolean;
  discordConnected: boolean;
  riotId: string;
  ignConfirmed: boolean;
  birthDate: string;
  gender: string;
  race: string[];
  countryOfBirth: string;
  primaryLanguageAtHome: string;
  isFreeOrReducedLunch?: boolean;
  isFirstGenCollege?: boolean;
  doePetitionConsent: boolean;
  surveyDetails: {
    ping: string;
    hoursPerWeek: string;
    internetReliability: string;
    careerInterests: string[];
    feedback: string;
  };
  codeOfConductAccepted: boolean;
}

export const CAREER_INTEREST_OPTIONS = [
  'Competitive Esports Player',
  'Game Design & Programming',
  'Streaming & Content Creation',
  'Broadcast & Live Production',
  'Esports Team Management & Coaching',
  'Graphic Design & Marketing',
  'Event Operations & Refereeing',
];

export const RACE_ETHNICITY_OPTIONS = [
  'Asian',
  'Black or African American',
  'Hispanic, Latino, or Spanish Origin',
  'White or Caucasian',
  'Native American or Indigenous',
  'Native Hawaiian or Other Pacific Islander',
  'Middle Eastern or North African',
  'Two or More Races',
  'Prefer not to say',
];
