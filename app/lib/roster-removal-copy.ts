/**
 * Confirmation wording for removing a player from a roster. Client-safe (no server imports) and
 * shared by the staff Schools & Rosters view and the manager portal so both say the same thing.
 *
 * It must stay in step with app/lib/db/roster-removal.ts: the roster spot is always deleted, and the
 * student's own record only when none of the keep-reasons applies (KeepReason there). The dialog
 * cannot know which case applies, so it states the rule and lists every keeper.
 */
export function rosterRemovalConfirmMessage(playerName: string, rosterName: string): string {
  return (
    `Remove ${playerName} from ${rosterName}? This permanently deletes their roster spot. ` +
    `If they are not on any other roster and have no match history, their student record is deleted too: ` +
    `their profile, onboarding answers, demographic answers, signed consent form, any content-warning overrides, linked Discord and Riot accounts and their used invite. ` +
    `They would have to be invited and onboarded again. ` +
    `Their student record is kept if they are on another roster, a staff member, a school manager, ` +
    `have a leadership or people profile, are in the league archive, or have match history. ` +
    `This cannot be undone.`
  );
}
