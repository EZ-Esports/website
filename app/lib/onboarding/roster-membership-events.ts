import { after } from 'next/server';

/**
 * Seam for side effects that must follow a change to who is on a roster. Roster mutations call it
 * AFTER their database transaction has committed and never inside one, so a slow or failing
 * consumer can neither hold a transaction open nor roll back a roster change that already
 * succeeded.
 *
 * Its consumer is the Discord tier-role sync (`tier-role-sync.ts`). It receives the ids of the
 * members whose roster membership (enrolled, removed, moved, or role changed) may have changed
 * and re-derives each member's desired roles from the database rather than trusting the call as a
 * diff, so it may arrive more than once for the same member.
 *
 * The sync is scheduled with `after()` so the manager's click returns without waiting on Discord.
 * Where there is no request scope (a script, a test) `after()` throws and the sync runs inline.
 *
 * Contract: this function never throws. Failures are logged (message only, no stack or member
 * data) and swallowed, because the roster change has already been committed.
 */
export async function notifyRosterMembershipChanged(memberIds: string[]): Promise<void> {
  try {
    const unique = [...new Set(memberIds)];
    if (unique.length === 0) return;

    const run = async () => {
      try {
        // Loaded lazily so callers that never reach a consumer do not pull in the database client.
        const { syncTierRolesForMembers } = await import('./tier-role-sync');
        await syncTierRolesForMembers(unique);
      } catch (error) {
        console.error('Discord tier role sync failed:', error instanceof Error ? error.name : 'unknown error');
      }
    };

    try {
      after(run);
    } catch {
      await run();
    }
  } catch (error) {
    console.error(
      'notifyRosterMembershipChanged failed:',
      error instanceof Error ? error.message : 'unknown error'
    );
  }
}
