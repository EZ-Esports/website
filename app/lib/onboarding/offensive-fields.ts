/**
 * The student-typed onboarding fields screened for offensive language, shared by the wizard (immediate
 * feedback) and the server submission pipeline (enforcement). Pure: no DB, no server-only imports.
 *
 * `key` is the field name the wizard routes on and the value stored in content overrides. `label` is the
 * only thing shown to the student; the offending word is never echoed back.
 */
import { containsOffensiveLanguage, type OffensiveCheckOptions } from './profanity';

export type OffensiveFieldKey =
  | 'legalFirstName'
  | 'legalLastName'
  | 'riotId'
  | 'countryOfBirth'
  | 'primaryLanguageAtHome'
  | 'feedback'
  | 'participantLegalName'
  | 'guardianFullName'
  | 'guardianRelationship'
  | 'guardianSignature';

export interface OffensiveFieldSpec {
  key: OffensiveFieldKey;
  label: string;
  options: OffensiveCheckOptions;
  /** Guardian fields exist only on the minor consent path, so they are screened only for minors. */
  minorOnly?: boolean;
}

export const OFFENSIVE_FIELD_SPECS: readonly OffensiveFieldSpec[] = [
  { key: 'legalFirstName', label: 'your legal first name', options: { kind: 'name' } },
  { key: 'legalLastName', label: 'your legal last name', options: { kind: 'name' } },
  { key: 'riotId', label: 'your Riot ID', options: { kind: 'handle' } },
  { key: 'countryOfBirth', label: 'your country of birth', options: { kind: 'text' } },
  { key: 'primaryLanguageAtHome', label: 'your primary language at home', options: { kind: 'text' } },
  { key: 'feedback', label: 'the "anything else" answer', options: { kind: 'text' } },
  {
    key: 'participantLegalName',
    label: 'the participant name on the consent form',
    options: { kind: 'name' },
    // Adults never see this field; their legal name is already screened in Step 1.
    minorOnly: true,
  },
  {
    key: 'guardianFullName',
    label: 'the guardian name on the consent form',
    options: { kind: 'name' },
    minorOnly: true,
  },
  {
    key: 'guardianRelationship',
    label: 'the guardian relationship on the consent form',
    options: { kind: 'text' },
    minorOnly: true,
  },
  {
    key: 'guardianSignature',
    label: 'the guardian signature on the consent form',
    options: { kind: 'name' },
    minorOnly: true,
  },
];

/** The specs that apply to this submission: guardian fields only when the consent is for a minor. */
export function specsFor(isMinor: boolean): OffensiveFieldSpec[] {
  return OFFENSIVE_FIELD_SPECS.filter((spec) => !spec.minorOnly || isMinor);
}

/**
 * Keys of the applicable fields whose current value is flagged, in form order. A non-string value is not
 * flagged here; the server rejects non-string input before it reaches this check.
 */
export function findFlaggedFields(
  values: Partial<Record<OffensiveFieldKey, unknown>>,
  isMinor: boolean
): OffensiveFieldKey[] {
  return specsFor(isMinor)
    .filter((spec) => {
      const value = values[spec.key];
      return typeof value === 'string' && containsOffensiveLanguage(value.trim(), spec.options);
    })
    .map((spec) => spec.key);
}

/** Field names as staff see them on the roster page. */
export const OFFENSIVE_FIELD_STAFF_LABELS: Readonly<Record<OffensiveFieldKey, string>> = {
  legalFirstName: 'Legal first name',
  legalLastName: 'Legal last name',
  riotId: 'Riot ID',
  countryOfBirth: 'Country of birth',
  primaryLanguageAtHome: 'Primary language at home',
  feedback: 'Anything else (feedback)',
  participantLegalName: 'Participant name (consent form)',
  guardianFullName: 'Guardian name (consent form)',
  guardianRelationship: 'Guardian relationship (consent form)',
  guardianSignature: 'Guardian signature (consent form)',
};
