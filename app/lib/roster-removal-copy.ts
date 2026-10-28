/**
 * Confirmation wording for removing a player from a roster. Client-safe (no server imports) and
 * shared by the staff Schools & Rosters view and the manager portal so both say the same thing.
 *
 * It must stay in step with app/lib/db/roster-removal.ts: the roster spot is always deleted, and the
 * student's own record only when they are on no other roster, are not staff / a manager, and have no
 * match history. The dialog cannot know which case applies, so it states the rule.
 */
export function rosterRemovalConfirmMessage(playerName: string, rosterName: string): string {
  return (
    `Remove ${playerName} from ${rosterName}? This permanently deletes their roster spot. ` +
    `If they are not on any other roster and have no match history, their student record is deleted too: ` +
    `their profile, onboarding answers, signed consent form, linked Discord and Riot accounts and their used invite. ` +
    `They would have to be invited and onboarded again. ` +
    `Staff, school managers and anyone with match history keep their student record. This cannot be undone.`
  );
}
