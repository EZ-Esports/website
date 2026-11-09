/**
 * Confirmation wording for removing a player from a roster. Client-safe (no server imports) and
 * shared by the staff Schools & Rosters view and the manager portal so both say the same thing.
 *
 * Deliberately short: the owner wants the dialog to say only that the removal is permanent and
 * cannot be undone. What else the server deletes (see app/lib/db/roster-removal.ts) is reported in
 * the notice shown after the removal, not here.
 */
export function rosterRemovalConfirmMessage(playerName: string, rosterName: string): string {
  return `Remove ${playerName} from ${rosterName}? This will remove them permanently. This action cannot be undone.`;
}
