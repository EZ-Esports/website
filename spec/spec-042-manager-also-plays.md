# spec-042: Managers Who Also Play

- **Spec ID:** spec-042
- **Title:** "I also play in this league" in the manager onboarding wizard
- **Status:** Implemented on branch `worktree-agent-a26eb6f37f4e3b2bb`; not pushed. **No migration.**
- **Date:** 2026-10-28
- **Issue:** #296
- **Builds on:** [spec-011](spec-011-player-onboarding-and-manager-portal.md), [spec-018](spec-018-manager-invites-table.md), [spec-029](spec-029-onboarding-consent-form.md), [spec-033](spec-033-discord-oauth-onboarding.md), [spec-035](spec-035-manager-discord-oauth.md), [spec-040](spec-040-onboarding-offensive-content-screen.md), [spec-041](spec-041-discord-oauth-second-tab.md)

## Context & Motivation

A school manager who also plays had to onboard twice: once through the manager invite and again through a player invite. The manager wizard already runs the same five steps as the player wizard (Discord OAuth, Riot ID, demographics and rules, consent, content screen), so the only things missing were the question, the games, and a player submission.

## Design Decisions

- **One person, one `members` row.** Members are matched by `members.email` (`upsertMemberRecord`). The combined path runs that once, so the manager and player records hang off the same member. Verified against the code, not assumed: `processOnboardingSubmission` already allows a Discord account whose existing owner *is* the member being written (`discordOwner && discordOwner !== memberId` is the only rejection), and `upsertPlayerIdentities` updates the member's existing Discord/Riot rows instead of inserting. So no schema or identity change was needed, and the unique `(provider, provider_user_id)` index still rejects a Discord account linked to a different member (`discord_already_linked`).
- **Reuse in both directions.** An existing manager who later uses a player invite, and a player who later uses a manager invite, attach to the same member as long as the email matches. A different email with the same Discord account is still a different member and is still rejected; that was deliberately not loosened. Known edge, left alone: `upsertMemberRecord` overwrites `members.school_id`, so using an invite from a second school moves the member to it.
- **Wizard.** Step 1 (manager invites only) gets a "Will you also be playing?" group with one checkbox, **I also play in this league**, unchecked by default. Checking it reveals a "Which games do you play?" checkbox list (`InviteData.playableGames`, supplied by `validateInviteToken` for manager invites only, from the `games` table). Because it defaults to unchecked, a non-playing manager sees one extra unticked box and nothing else changes: same five steps, same validation. For a playing manager the Riot ID step uses the player wording. Step 1 validation requires at least one game when the box is checked.
- **Submission.** `PlayerOnboardingSubmission` gains `alsoPlays?` and `playGameIds?`. They are honoured only for a manager invite and only when `alsoPlays === true`; the ids are bounded by `sanitizeGameIds` (`app/lib/onboarding/play-games.ts`) and every id must exist in `games`, otherwise the rejection `play_games_required` is returned before anything is written (wizard returns to step 1).
- **What gets created.** In the same transaction as the member, identities, demographics, consent, `school_managers` row and manager invite acceptance, one `player_invites` row per chosen game is inserted with `status = 'submitted'`, `member_id` set, `invited_by_user_id` taken from the manager invite, a random unreachable `token_hash`, and `submission_draft = { source: 'manager_also_plays' }` (`ensurePlayerSubmission` in `app/lib/db/onboarding.ts`). It is exactly what a player's own wizard submission leaves behind. A member that already has a live (not rejected or expired) row for that school and game gets no second one.
- **Same review and roster rules as any student.** The row shows up in the manager's Approve / Reject queue and is approved through `reviewPlayerInvite`, which already enforces the manager's season scope (`assertManagerForSchoolGame` and season resolution by name, spec-026), the inactive-season view-only rule (spec-028), the season roster lock (spec-020; staff admins exempt), one tier per game (spec-034) and roster size caps. Nothing in the portal, `enrollPlayerToRoster`, `getSchoolPlayerPool`, roster move or staff roster editing excludes a member who is also a manager, so after approval they can be rostered and can manage rosters. There is no auto-approval: a manager cannot bypass the lock by ticking the box.
- **Drafts.** `sanitizeDraftData` keeps `alsoPlays` only as a boolean and `playGameIds` only as a bounded list of unique strings; `saveOnboardingDraft` removes both from player-invite drafts. `managedGames` and `isPrimaryContact` stay staff-owned (the existing merge). `password` is still never stored, so the spec-035/041 password re-entry rules are unchanged; the choice and games survive the Discord round trip through the draft, and the second-tab flow keeps them in memory. The wizard ignores draft game ids that are not in `playableGames`.
- **Discord.** Done once, through the unchanged OAuth flow; the identity still comes only from the signed cookie.
- **Success page.** A playing manager sees an extra line that their player application is in the review queue.

## Invariants & Boundaries

- No schema change, no migration, no new table.
- Manager-only onboarding is unchanged on the server (absent or false `alsoPlays` writes nothing extra).
- A browser cannot create a player submission for an unknown game, on a player invite, or without checking the box.
- Out of scope: auto-enrolling the manager on a roster, matching members by Discord when the email differs, and moving a member back when a second school's invite is used.

## Verification

- `npx vitest run app/lib/onboarding/__tests__/milestone4-player-wizard.test.ts "app/(marketing)/join"`: manager-only unchanged; combined path creates one member, one `school_managers` row, one Discord identity, one Riot identity and one submitted `player_invites` row; unknown/empty games rejected with nothing written; Discord owned by another member still rejected; manager-then-player and player-then-manager reuse the member; no duplicate application; playable games only on manager invites; draft shape and staff-owned keys. Component tests in `__tests__/manager-also-plays.test.tsx`.
- Review, roster-lock and season-scope behaviour is covered by the existing `reviewPlayerInvite` and season-lock suites (`milestone3-portal-actions.test.ts` section 9, `season-lock-local-db.test.ts`); the new row is an ordinary `submitted` player invite, so no separate path exists to test.
- Not checked in a browser or against real Discord/Supabase.
