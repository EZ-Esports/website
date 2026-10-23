/**
 * EZ Esports Onboarding Consent Form: wording, age rule and validation.
 *
 * Shared by the wizard UI and the server-side submission pipeline so the text a
 * signer saw and the rules the server enforces cannot drift apart. Pure module:
 * no `server-only`, no I/O.
 *
 * The strings below are legal text supplied by EZ Esports. Do not reword them.
 * Any change to wording or to what the form collects must bump
 * `CONSENT_FORM_VERSION`; each stored consent row records the version the signer
 * saw, and `consent.test.ts` pins a hash of this text to force the bump.
 */

import { ROUTES } from '@/app/lib/constants';

export const CONSENT_FORM_VERSION = '2026-10-v1';

/** Where the Terms of Service the signer is asked to review live. */
export const TERMS_OF_SERVICE_PATH = ROUTES.terms;

/** Participants younger than this need a parent or legal guardian to authorize. */
export const ADULT_AGE = 18;

export const CONSENT_TEXT = {
  guardianHeading: 'Parent or Legal Guardian Authorization',
  /** Intro shown only to participants under 18; `{age}` is replaced with the computed age. */
  guardianIntro:
    'You have entered your age as {age}. Because you are under the age of 18, a parent or legal guardian must review and authorize your participation in EZ Esports.',
  termsLinkLead: 'Please review the EZ Esports Terms of Service here:',
  tosHeading: '1. Terms of Service Acknowledgment',
  tosCheckbox:
    'By checking this box, I confirm that I have read and understood the EZ Esports Terms of Service.',
  participantHeading: '2. Participant Information',
  participantNameLabel: "Participant's Full Legal Name:",
  authorizationHeading: '3. Parent or Legal Guardian Authorization',
  authorizationLead: 'By completing and submitting this form, I confirm that:',
  authorizationItems: [
    'I am the parent or legal guardian of the participant identified above and have the legal authority to provide this authorization.',
    'I authorize the participant to participate in EZ Esports programs, subject to the applicable Terms of Service, program rules, and eligibility requirements.',
    "I have reviewed and accept the EZ Esports Terms of Service on behalf of myself to the extent applicable and acknowledge the participant's obligations under those terms.",
    'I understand that EZ Esports retains final decision-making authority over its programs, including participation approval, eligibility, scheduling, rule enforcement, and suspension or removal from participation, subject to applicable law.',
  ],
  guardianInfoHeading: '4. Parent or Legal Guardian Information',
  guardianNameLabel: 'Full Legal Name:',
  guardianRelationshipLabel: 'Relationship to Participant:',
  guardianEmailLabel: 'Email Address:',
  signatureHeading: '5. Electronic Signature',
  signatureIntro:
    'By entering my initials below and submitting this form, I intend to electronically sign this authorization and confirm that the information provided is accurate.',
  signatureLabel: "Parent or Legal Guardian's Initials / Electronic Signature:",
  dateLabel: 'Date:',
} as const;

/** What the signer submits. Everything below `tosAcknowledged` applies only to participants under 18. */
export interface ConsentSubmission {
  tosAcknowledged: boolean;
  participantLegalName?: string;
  guardianFullName?: string;
  guardianRelationship?: string;
  guardianEmail?: string;
  /** Initials or full name typed as the electronic signature. */
  guardianSignature?: string;
}

/** A validated consent, ready to persist. `signedAt` is stamped by the caller on the server. */
export interface NormalizedConsent {
  formVersion: string;
  isMinor: boolean;
  ageAtSigning: number;
  tosAcknowledged: true;
  participantLegalName: string;
  guardianFullName: string | null;
  guardianRelationship: string | null;
  guardianEmail: string | null;
  guardianSignature: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 200;

/** Calendar date in New York (the league's home time zone) for a given instant. */
function newYorkToday(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

/** Earliest date of birth accepted; guards against 5-6 digit years from native date inputs. */
export const MIN_BIRTH_DATE = '1900-01-01';

/** True for a `YYYY-MM-DD` date of birth between MIN_BIRTH_DATE and now. */
export function isPlausibleBirthDate(birthDate: Date, now: Date = new Date()): boolean {
  return (
    !isNaN(birthDate.getTime()) &&
    birthDate.getTime() >= new Date(MIN_BIRTH_DATE).getTime() &&
    birthDate.getTime() <= now.getTime()
  );
}

/**
 * Whole years between a date of birth and today (New York calendar date).
 * The date of birth is read as a calendar date from its UTC components, which is
 * how `<input type="date">` values (`YYYY-MM-DD`) parse.
 */
export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  const today = newYorkToday(now);
  let age = today.year - birthDate.getUTCFullYear();
  const monthDiff = today.month - (birthDate.getUTCMonth() + 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.day < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function isMinorAge(age: number): boolean {
  return age < ADULT_AGE;
}

export function formatConsentIntro(age: number): string {
  return CONSENT_TEXT.guardianIntro.replace('{age}', String(age));
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates a consent submission against the participant's age. This is the
 * authoritative check: the client mirrors it for UX but cannot bypass it.
 * Error messages never echo submitted values (they can be a minor's or guardian's PII).
 */
export function validateConsent(
  consent: ConsentSubmission | null | undefined,
  context: { age: number; fallbackParticipantName: string }
): NormalizedConsent {
  if (!consent || consent.tosAcknowledged !== true) {
    throw new Error('You must acknowledge the EZ Esports Terms of Service to complete onboarding.');
  }

  const isMinor = isMinorAge(context.age);
  const participantLegalName =
    clean(consent.participantLegalName) || (isMinor ? '' : context.fallbackParticipantName);

  if (!isMinor) {
    return {
      formVersion: CONSENT_FORM_VERSION,
      isMinor: false,
      ageAtSigning: context.age,
      tosAcknowledged: true,
      participantLegalName,
      guardianFullName: null,
      guardianRelationship: null,
      guardianEmail: null,
      guardianSignature: null,
    };
  }

  const guardianFullName = clean(consent.guardianFullName);
  const guardianRelationship = clean(consent.guardianRelationship);
  const guardianEmail = clean(consent.guardianEmail).toLowerCase();
  const guardianSignature = clean(consent.guardianSignature);

  if (!participantLegalName) {
    throw new Error("The participant's full legal name is required for parent or guardian authorization.");
  }
  if (!guardianFullName) {
    throw new Error("The parent or legal guardian's full legal name is required.");
  }
  if (!guardianRelationship) {
    throw new Error('The parent or legal guardian must state their relationship to the participant.');
  }
  if (!guardianEmail || !EMAIL_PATTERN.test(guardianEmail)) {
    throw new Error("A valid parent or legal guardian email address is required.");
  }
  if (guardianSignature.length < 2) {
    throw new Error('The parent or legal guardian must enter their initials or full name as an electronic signature.');
  }
  for (const value of [participantLegalName, guardianFullName, guardianRelationship, guardianEmail, guardianSignature]) {
    if (value.length > MAX_FIELD_LENGTH) {
      throw new Error('A consent form field is too long.');
    }
  }

  return {
    formVersion: CONSENT_FORM_VERSION,
    isMinor: true,
    ageAtSigning: context.age,
    tosAcknowledged: true,
    participantLegalName,
    guardianFullName,
    guardianRelationship,
    guardianEmail,
    guardianSignature,
  };
}
