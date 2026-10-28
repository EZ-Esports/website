/**
 * Expected, student-fixable submission failures. Server actions return these as a result object
 * (not a thrown Error) because production builds mask thrown error messages.
 */
export type OnboardingRejectionCode =
  | 'discord_required'
  | 'discord_not_in_guild'
  | 'discord_already_linked'
  | 'manager_password_required'
  | 'offensive_content'
  | 'code_of_conduct_required'
  | 'terms_required';

export class OnboardingRejection extends Error {
  readonly code: OnboardingRejectionCode;
  /** Form field the student must fix (e.g. "riotId"), so the wizard can send them to its step. */
  readonly field?: string;

  constructor(code: OnboardingRejectionCode, message: string, options?: { field?: string }) {
    super(message);
    this.name = 'OnboardingRejection';
    this.code = code;
    this.field = options?.field;
  }
}

/** True when a Postgres error (possibly wrapped by the driver) is a unique violation on the Discord identity index. */
export function isDiscordIdentityUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: any = err;
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const constraint = cur.constraint_name ?? cur.constraint;
    if (cur.code === '23505' && (!constraint || constraint === 'player_identities_provider_user_idx')) {
      if (constraint || String(cur.message ?? '').includes('player_identities_provider_user_idx')) return true;
    }
    cur = cur.cause;
  }
  return false;
}
