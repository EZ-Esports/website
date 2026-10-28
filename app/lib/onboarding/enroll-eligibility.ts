/**
 * Whether a student has been onboarded for a season, which is what lets a school manager put them
 * on that season's rosters (spec-046). Pure and client-safe so the Enroll dialog and the server
 * action share one rule.
 *
 * A student is enrollable on a roster of game G, season S only with an ACCEPTED application for G
 * whose season is S. Everything else is not enough: no application at all (archive-imported or
 * staff-created members), applications only for other seasons or with no season, and anything
 * submitted, pending, rejected or expired. A player from a past season therefore has to be
 * onboarded again for a new one. Staff admins are exempt and never call this.
 */
export interface EnrollmentInvite {
  /** Lets the portal update one application locally after Approve. */
  id?: string;
  gameId: string | null;
  seasonId: string | null;
  status: string;
}

export function hasAcceptedApplicationForSeason(
  invites: EnrollmentInvite[],
  gameId: string,
  seasonId: string
): boolean {
  return invites.some((i) => i.status === 'accepted' && i.gameId === gameId && i.seasonId === seasonId);
}

export function notOnboardedForSeasonError(playerName: string, seasonName: string | null): string {
  return `${playerName} has not been onboarded for ${seasonName ?? 'this season'}. Send them an invite and approve it first.`;
}
