/**
 * Seam for side effects that must follow a change to who is on a roster (for example syncing
 * Discord roles). Roster mutations call it AFTER their database transaction has committed and
 * never inside one, so a slow or failing consumer can neither hold a transaction open nor roll
 * back a roster change that already succeeded.
 *
 * It is a documented no-op today. A consumer plugs in here and receives the ids of the members
 * whose roster membership (enrolled, removed, moved, or role changed) may have changed. The
 * consumer is expected to re-derive the member's desired state from the database rather than
 * trust the call as a diff, and the call may arrive more than once for the same member. A removal
 * can delete the member itself (spec-042), so an id may no longer exist: treat a missing member as
 * "no roster membership left" (for example, remove its Discord roles), not as an error.
 *
 * Contract: this function never throws. Failures are logged (message only, no stack or member
 * data) and swallowed, because the roster change has already been committed.
 */
export async function notifyRosterMembershipChanged(memberIds: string[]): Promise<void> {
  try {
    const unique = [...new Set(memberIds)];
    if (unique.length === 0) return;
    // Intentionally empty: no consumer is registered yet.
  } catch (error) {
    console.error(
      'notifyRosterMembershipChanged failed:',
      error instanceof Error ? error.message : 'unknown error'
    );
  }
}
