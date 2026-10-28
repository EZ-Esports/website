/**
 * Whether a student's onboarding applications allow a school manager to put them on a roster
 * (spec-046). Pure and client-safe so the Enroll dialog and the server action share one rule.
 *
 * A student is NOT enrollable on a roster of game G, season S when they have an application for G
 * IN SEASON S that is still submitted, pending or rejected, and none accepted for S. Only the
 * roster's own season counts: a returning player with a stale old-season row, or a seasonless
 * legacy row a manager can never see or review, must not become a dead end that only staff can
 * clear. A student with no application, or an accepted one for S, is enrollable. Other games and
 * expired applications are ignored. Staff admins are exempt and never call this.
 */
export interface EnrollmentInvite {
  /** Lets the portal update one application locally after Approve. */
  id?: string;
  gameId: string | null;
  seasonId: string | null;
  status: string;
}

const UNACCEPTED = new Set(['submitted', 'pending', 'rejected']);

export function hasUnacceptedApplication(
  invites: EnrollmentInvite[],
  gameId: string,
  seasonId: string
): boolean {
  const thisSeason = invites.filter((i) => i.gameId === gameId && i.seasonId === seasonId);
  if (thisSeason.some((i) => i.status === 'accepted')) return false;
  return thisSeason.some((i) => UNACCEPTED.has(i.status));
}

export function applicationNotAcceptedError(playerName: string): string {
  return `${playerName} has an application that has not been accepted yet. Approve it first.`;
}
