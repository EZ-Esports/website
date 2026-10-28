import { checkProfanity, type ProfanityMatch } from '@/app/lib/profanity/detect';

/**
 * Which onboarding fields are screened for offensive content, shared by the wizard (so the person
 * sees the problem next to the field) and the submission pipeline (which does not trust the browser).
 *
 * Only free text that ends up on a roster, a bracket or a record is screened. Email, password, dates
 * and the pick-lists are not. The Discord username is screened too: it comes from Discord, not from
 * a field here, but it is shown to opponents and staff, so it follows the same override path.
 */
export const CONTENT_FIELDS = {
  legalFirstName: { label: 'legal first name', step: 1 },
  legalLastName: { label: 'legal last name', step: 1 },
  discordUsername: { label: 'Discord username', step: 2 },
  riotId: { label: 'Riot ID', step: 3 },
  countryOfBirth: { label: 'country of birth', step: 4 },
  primaryLanguageAtHome: { label: 'primary language at home', step: 4 },
  feedback: { label: 'notes for staff', step: 4 },
  participantLegalName: { label: 'participant legal name', step: 5 },
  guardianFullName: { label: 'guardian full name', step: 5 },
  guardianRelationship: { label: 'guardian relationship', step: 5 },
  guardianSignature: { label: 'signature', step: 5 },
} as const;

export type ContentFieldKey = keyof typeof CONTENT_FIELDS;

export const CONTENT_FIELD_KEYS = Object.keys(CONTENT_FIELDS) as ContentFieldKey[];

export function isContentFieldKey(value: unknown): value is ContentFieldKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONTENT_FIELDS, value);
}

export type ContentFieldValues = Partial<Record<ContentFieldKey, string | null | undefined>>;

export interface FlaggedField {
  field: ContentFieldKey;
  label: string;
  /** The value as submitted (trimmed), kept so staff can see exactly what was overridden. */
  value: string;
  matches: ProfanityMatch[];
}

export const CONTENT_FLAGGED_MESSAGE =
  'Some of the information you entered looks like it may contain offensive language. Offensive names and usernames are not allowed. Fix the highlighted field, or if it is genuinely your information, tick "This is actually my real information". Staff will review it.';

/** Returns the screened fields whose value trips the profanity check, in a stable order. */
export function findFlaggedFields(values: ContentFieldValues): FlaggedField[] {
  const flagged: FlaggedField[] = [];
  for (const field of CONTENT_FIELD_KEYS) {
    const raw = values[field];
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    const result = checkProfanity(value);
    if (result.flagged) {
      flagged.push({ field, label: CONTENT_FIELDS[field].label, value, matches: result.matches });
    }
  }
  return flagged;
}

interface SubmissionTextShape {
  legalFirstName?: string;
  legalLastName?: string;
  riotId?: string;
  countryOfBirth?: string;
  primaryLanguageAtHome?: string;
  surveyDetails?: { feedback?: string } | null;
  consent?: {
    participantLegalName?: string | null;
    guardianFullName?: string | null;
    guardianRelationship?: string | null;
    guardianSignature?: string | null;
  } | null;
}

/**
 * Pulls the screened values out of a submission. The participant legal name is prefilled from the
 * first and last name, so it is only screened when the signer changed it; otherwise a flagged name
 * would ask for two overrides.
 */
export function collectContentValues(
  submission: SubmissionTextShape,
  discordUsername?: string | null
): ContentFieldValues {
  const consent = submission.consent ?? {};
  const fullName = `${(submission.legalFirstName ?? '').trim()} ${(submission.legalLastName ?? '').trim()}`
    .trim()
    .toLowerCase();
  const participant = (consent.participantLegalName ?? '').trim();
  return {
    legalFirstName: submission.legalFirstName,
    legalLastName: submission.legalLastName,
    discordUsername,
    riotId: submission.riotId,
    countryOfBirth: submission.countryOfBirth,
    primaryLanguageAtHome: submission.primaryLanguageAtHome,
    feedback: submission.surveyDetails?.feedback,
    participantLegalName: participant.toLowerCase() === fullName ? undefined : participant,
    guardianFullName: consent.guardianFullName,
    guardianRelationship: consent.guardianRelationship,
    guardianSignature: consent.guardianSignature,
  };
}

/** Wizard step that holds the first of these fields, so a server rejection lands on the right page. */
export function stepForContentFields(fields: readonly string[]): 1 | 2 | 3 | 4 | 5 {
  const steps = fields.filter(isContentFieldKey).map((f) => CONTENT_FIELDS[f].step);
  return (steps.length ? Math.min(...steps) : 1) as 1 | 2 | 3 | 4 | 5;
}

export interface ContentCheckOutcome {
  /** Fields that tripped the check but were overridden by the person; to be recorded for staff. */
  overridden: FlaggedField[];
  /** Fields that tripped the check with no override; the submission must be rejected. */
  blocked: FlaggedField[];
}

/**
 * Decides what a submission may do. An override only counts for a field that actually trips the
 * check now, and the client never decides which fields are flagged: the server recomputes them.
 */
export function evaluateContent(
  values: ContentFieldValues,
  overrides: readonly unknown[] | null | undefined
): ContentCheckOutcome {
  const allowed = new Set((Array.isArray(overrides) ? overrides : []).filter(isContentFieldKey));
  const flagged = findFlaggedFields(values);
  return {
    overridden: flagged.filter((f) => allowed.has(f.field)),
    blocked: flagged.filter((f) => !allowed.has(f.field)),
  };
}
