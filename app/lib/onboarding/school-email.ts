/**
 * School email rules for onboarding (spec-056). Shared by the wizard (early feedback) and the
 * submission pipeline (the authoritative check), so it has no server-only imports.
 *
 * The address is typed, not verified by sign-in (NYCPS blocks Google OAuth), so the only guarantee here
 * is that it is a well-formed address on exactly the nycstudents.net domain. Staff compare it with the
 * uploaded student ID.
 */

export const SCHOOL_EMAIL_DOMAIN = 'nycstudents.net';

export const SCHOOL_EMAIL_REQUIRED_MESSAGE = `A school email address ending in @${SCHOOL_EMAIL_DOMAIN} is required.`;
export const SCHOOL_EMAIL_DOMAIN_MESSAGE = `Your school email must end in @${SCHOOL_EMAIL_DOMAIN}.`;
export const SCHOOL_EMAIL_SAME_MESSAGE =
  'Your personal email and school email must be different addresses. Enter your personal email in the first field.';
export const SCHOOL_EMAIL_ALREADY_USED_MESSAGE =
  'This school email is already registered with another EZ Esports member. Please check it for typos, or contact EZ Esports if you think this is a mistake.';

/**
 * One local part, then exactly `@nycstudents.net` to the END of the string. The local part allows no
 * `@` or whitespace, so `x@nycstudents.net@evil.com` fails, and the `$` anchor means
 * `x@nycstudents.net.evil.com` and `x@evilnycstudents.net` fail.
 */
const SCHOOL_EMAIL_PATTERN = /^[^\s@]+@nycstudents\.net$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True for a well-formed address on exactly the school domain (input is normalized first). */
export function isSchoolEmail(value: unknown): boolean {
  return SCHOOL_EMAIL_PATTERN.test(normalizeEmail(value));
}

/**
 * Returns the problem with a school email, or null when it is acceptable. `personalEmail` is the other
 * email field; the two must differ.
 */
export function checkSchoolEmail(schoolEmail: unknown, personalEmail: unknown): string | null {
  const school = normalizeEmail(schoolEmail);
  if (!school) return SCHOOL_EMAIL_REQUIRED_MESSAGE;
  if (!school.includes('@')) return 'Your school email address must include an @ symbol.';
  if (!SCHOOL_EMAIL_PATTERN.test(school)) return SCHOOL_EMAIL_DOMAIN_MESSAGE;
  if (school === normalizeEmail(personalEmail)) return SCHOOL_EMAIL_SAME_MESSAGE;
  return null;
}
