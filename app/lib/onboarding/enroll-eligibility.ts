/**
 * Whether a student's onboarding applications allow a school manager to put them on a roster
 * (spec-046). Pure and client-safe so the Enroll dialog and the server action share one rule.
 *
 * A student is NOT enrollable on a roster of game G, season S when they have any application for G
 * at the school that is still submitted, pending or rejected, and none that was accepted for S.
 * A student with no application at all (returning or imported players) stays enrollable, and an
 * accepted application for S outranks older rejected or unreviewed ones. Applications of other
 * games, and expired ones, are ignored. Staff admins are exempt and never call this.
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
  const forGame = invites.filter((i) => i.gameId === gameId);
  if (forGame.some((i) => i.status === 'accepted' && i.seasonId === seasonId)) return false;
  return forGame.some((i) => UNACCEPTED.has(i.status));
}

export function applicationNotAcceptedError(playerName: string): string {
  return `${playerName} has an application that has not been accepted yet. Approve it first.`;
}
