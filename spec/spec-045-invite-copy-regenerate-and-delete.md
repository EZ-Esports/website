# spec-045: Invite history: copy a working link and delete invites

- **Spec ID:** spec-045
- **Title:** Manager portal invite history can issue a fresh working link and delete pending invites; player invite lifetimes are 3, 5 or 7 days
- **Status:** Implemented on branch `fix/293-invite-delete-copy` (issue #293). No schema change, no migration.
- **Date:** 2026-10-28
- **Scope:** `regeneratePlayerInviteLink` and `deletePlayerInvite` in `app/lib/onboarding/portal-actions.ts`, `app/lib/onboarding/invite-expiry.ts`, `GenerateInviteCard.tsx`, `InvitesHistoryTable.tsx`, `SchoolPortalClient.tsx`, tests.

## Context

The history table's only action copied `/join/{school}/{game}` with no token, which no one can use. Tokens are stored only as SHA-256 hashes (spec-011, spec-018), so the original link cannot be recovered, and there was no way to remove an invite made by mistake.

## Decisions

- **Regenerate, not store tokens.** "Copy link" replaces the stored hash with a new token's hash, resets the expiry to 7 days from now (the maximum, `DEFAULT_INVITE_EXPIRY_DAYS`; it does not try to reproduce the invite's original duration, which is not stored), and returns the new URL once; the client copies it immediately. Storing encrypted tokens was rejected: it needs a new secret and key management and changes the threat model of spec-018 (a database leak would then expose live links). Cost: copying invalidates the link that was previously shared, so the action opens a confirmation dialog saying so (spec-037 conventions: portal appearance, Cancel first, failure shown in the dialog).
- **Clipboard fallback.** The write happens after a server round trip, which some browsers refuse as outside a user gesture. If it fails, the new link is shown in a read-only field under the row to copy by hand.
- **Only pending invites.** Regenerate and delete are refused server-side for `submitted`, `accepted` and `rejected` invites (they are the review trail and tied to a student record; accepted tokens must stay spent). A pending invite whose time has run out is still `pending`, so it can be regenerated (which renews it) or deleted. The UI hides the actions on other rows.
- **Delete** removes the `player_invites` row, so the token no longer validates. The dialog says the link will stop working and the action cannot be undone. A half-filled saved draft on that invite is discarded with it.
- **Authorization.** The invite is loaded by id and `assertManagerForSchool(invite.schoolId, invite.gameId)` runs with the invite's own school and game, never client-supplied values; it throws Forbidden for another school or a game outside the manager's scope and refuses an inactive (view-only) season (spec-028). Staff admins pass as elsewhere. The write is conditional on `school_id` and `status = 'pending'`, so a submission that lands first wins.
- **Expected failures are returned, not thrown.** Next redacts thrown messages in production, so both actions return `{ success: false, error, status }` for not pending, not found, forbidden or unauthenticated, and the dialog shows `error`. `status` is the invite's current state (`null` when it no longer exists, `'forbidden'` when the caller may not act on it) so the portal removes a vanished row or corrects a stale status. A conditional write that matches nothing (a submission won the race) re-reads the status and returns the same shape.
- **Invite lifetimes: exactly 3, 5 or 7 days.** `INVITE_EXPIRY_DAYS` in `app/lib/onboarding/invite-expiry.ts` is shared by the server and the Link Expiration select (default 7, the previous 14-day option is gone). `createPlayerInvite` rejects any other `expiresInDays` (0, 4, 14, fractions, NaN, negatives) with an error instead of clamping; omitted means 7. Invites already issued with a longer expiry are untouched (no migration), and a regenerate shortens them to at most 7 days. Staff-provisioned manager invites (`manager_invites`, 14 days in `staff-manager-service.ts`) are a different flow and were not changed.
- **Accessibility.** The actions column shows "No actions available" as screen-reader text beside a hidden dash; a visually hidden `role="status"` region announces "Link copied" or "Copy failed, link shown below"; the manual-link field takes focus when it appears.
- **Cache tags.** None. The portal reads invites with plain queries (no `unstable_cache`), and a pending invite is not referenced by any cached roster, member or player data. The client updates its local list.
- Manager invites (`manager_invites`) are not in this table and are unchanged (staff revoke in the managers dialog).

## Verification

`milestone3-portal-actions.test.ts` (hash replaced and old token dead, delete, non-pending refused, other school and out-of-scope game and unauthenticated refused) and `invites-history-table.test.tsx` (actions only on pending, hidden for view-only, manual fallback), and `invite-actions.test.tsx` (SchoolPortalClient: confirm, regenerate, clipboard success and fallback, announcements, refusal shown in the dialog, row removed or corrected, delete). The old token is shown dead through `findInviteByTokenHash`; the lost-race, expired-pending renewal and 3/5/7 accept and reject cases are covered. Not exercised against a real database or a real browser clipboard.
