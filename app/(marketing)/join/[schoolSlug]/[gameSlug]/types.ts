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

export type WizardStep = 1 | 2 | 3 | 4 | 5;

/** Step that holds each free-text field the server can reject as offensive. */
const STEP_FOR_OFFENSIVE_FIELD: Readonly<Record<string, WizardStep>> = {
  legalFirstName: 1,
  legalLastName: 1,
  riotId: 3,
  countryOfBirth: 4,
  primaryLanguageAtHome: 4,
  feedback: 4,
  participantLegalName: 5,
  guardianFullName: 5,
  guardianRelationship: 5,
  guardianSignature: 5,
};

/**
 * Wizard step that fixes a rejection returned by the server. The password lives on step 1, Discord on
 * step 2, the Code of Conduct box on step 4, the Terms of Service box on step 5, and offensive content
 * goes to the step holding the offending field.
 */
export function stepForRejection(code: string, field?: string): WizardStep {
  if (code === 'manager_password_required') return 1;
  if (code === 'offensive_content') return STEP_FOR_OFFENSIVE_FIELD[field ?? ''] ?? 1;
  if (code === 'code_of_conduct_required') return 4;
  if (code === 'terms_required') return 5;
  return 2;
}

export interface WizardFormData {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  password?: string;
  graduationYear: number;
  /** Manager only: season the manager is applying for, e.g. "2026-27". */
  academicYear?: string;
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

/** Anticipated graduation years offered to everyone (students and managers), with grade for 2026-2027. */
export const GRADUATION_YEAR_OPTIONS = [
  { value: 2027, label: 'Class of 2027 (12th Grade / Senior)' },
  { value: 2028, label: 'Class of 2028 (11th Grade / Junior)' },
  { value: 2029, label: 'Class of 2029 (10th Grade / Sophomore)' },
  { value: 2030, label: 'Class of 2030 (9th Grade / Freshman)' },
] as const;

/** Seasons a School Manager can apply for (`YYYY-YY`, shared with the rest of the app). */
export { MANAGER_SEASON_OPTIONS, DEFAULT_MANAGER_SEASON } from '@/app/lib/season-name';

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
