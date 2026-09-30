export type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected';

/**
 * Valid status transitions for applications:
 * - pending (submitted): may transition to 'reviewed', 'accepted', or 'rejected'
 * - reviewed: may transition to 'accepted' or 'rejected'
 * - accepted: may transition to 'rejected' or 'reviewed'
 * - rejected: may transition to 'accepted' or 'reviewed'
 *
 * Note: Once an application is reviewed/decided, it cannot transition back to 'pending'.
 * Soft deletion is NOT a status transition; it sets deletedAt/deletedBy on the
 * application record and does NOT append a 'rejected' status log.
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  pending: ['reviewed', 'accepted', 'rejected'],
  reviewed: ['accepted', 'rejected'],
  accepted: ['rejected', 'reviewed'],
  rejected: ['accepted', 'reviewed'],
};

export function isValidStatusTransition(
  currentStatus: ApplicationStatus,
  targetStatus: ApplicationStatus
): boolean {
  if (currentStatus === targetStatus) return false;
  const allowed = APPLICATION_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
}
