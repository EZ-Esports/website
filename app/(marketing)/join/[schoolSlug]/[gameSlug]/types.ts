import { stepForContentFields, type ContentFieldKey } from '@/app/lib/onboarding/content-check';

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
  /** Manager invites only: games a manager can say they also play. */
  playableGames?: Array<{ id: string; slug: string; displayName: string }>;
}

/**
 * Wizard step that fixes a rejection returned by the server: the password lives on step 1, Discord
 * on step 2, and a flagged field on whichever step holds it.
 */
export function stepForRejection(code: string, fields: readonly string[] = []): 1 | 2 | 3 | 4 | 5 {
  if (code === 'content_flagged' || code === 'field_too_long') return stepForContentFields(fields);
  return code === 'manager_password_required' || code === 'play_games_required' ? 1 : 2;
}

/** What a step needs to warn about, and let the person override, one offensive-content flag. */
export interface ContentFlagControls {
  state(field: ContentFieldKey): { flagged: boolean; overridden: boolean };
  setOverride(field: ContentFieldKey, checked: boolean): void;
}

export interface WizardFormData {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  password?: string;
  graduationYear: number;
  /** Manager only: season the manager is applying for, e.g. "2026-27". */
  academicYear?: string;
  /** Manager only: null until answered. */
  alsoPlays?: boolean | null;
  playGameIds?: string[];
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
  /** Offensive-content overrides (field -> the value they were confirmed for); re-validated on restore and on the server. */
  contentOverrides?: Partial<Record<ContentFieldKey, string>>;
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
