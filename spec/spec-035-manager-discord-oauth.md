# spec-035: Discord OAuth for school managers, legacy self-reported Discord removed

- **Status:** Implemented and merged in PR #283 (issue #249, managers)
- **Date:** 2026-10-26
- **Builds on:** [spec-033](spec-033-discord-oauth-onboarding.md) (player flow, PR #281), issue #249
- **Schema:** none. No migration.

## Why

[spec-033](spec-033-discord-oauth-onboarding.md) verified Discord for players only. Manager invites kept the typed handle plus an "I joined" checkbox, and the pipeline used the typed handle as the Discord user id with `inGuild: true`. Comp Ops therefore still had unverified identities for the people who run each school. The owner decided managers use the same flow, Discord is required for them too, and every self-reported path is deleted.

## What changed

- **`/api/discord/start`** no longer bounces manager invites. A manager join URL is `/join/{school}/manager?token=`; `validateInviteToken` already accepts the pseudo game slug `manager` (manager invites have no game), and it fits the start route's slug regex. The callback returns to the same URL, so the flow cookie, result cookie, state and bot join are unchanged.
- **`resolveDiscordIdentity`** has one path for everyone: a result cookie bound to the invite hash with `inGuild: true`, otherwise a returned rejection (`discord_required`, `discord_not_in_guild`). The manager branch, the handle-as-id fallback and the "Discord username or handle is required" error are deleted. The one-Discord-account-per-member check (`discord_already_linked`, also mapped from the unique-index race) applies to managers; its message no longer says "another player".
- **Rejections are results.** `submitPlayerOnboarding` already returns `OnboardingRejection` as `{success:false, code, error}`; the manager wizard is the same component, so it clears its connected state, returns to step 2 and shows the message.
- **Submission type.** `PlayerOnboardingSubmission` no longer has `discordUsername`, `discordUserId` or `inGuild`. The server can learn Discord only from the signed cookie. The manager's `members.discord` and Discord `player_identities` row store the verified username.
- **Drafts.** `sanitizeDraftData` drops `discordUsername`, `discordUserId`, `inGuild`, `discordJoinedConfirmed` and `discordConnected` on save and on read, so a draft saved before this change loads without crashing and its legacy values are never trusted.
- **Wizard.** `DiscordStep` is Connect Discord only (no text input, checkbox or `isManager` split). `useWizardDraft` and `types.ts` lost `discordUsername`, `discordJoinedConfirmed` and `discordConnected`; `PlayerOnboardingWizard` stopped sending a handle and now passes the verified username to `SuccessStep` (whose own file is unchanged); `page.tsx` reads the cookie for every invite. `validateStep2` requires the verified state for everyone. Managers use the same five steps. A player resumes at step 2 after the OAuth redirect; a manager resumes at step 1 (see below).

## Review follow-ups

- **Manager password.** `password` is never persisted in the draft and the OAuth round trip reloads the page, so a returning manager has none. Client: a manager coming back from Discord starts at step 1 with "Please re-enter your password. It is not kept while you connect Discord."; submit re-runs `validateStep1` and returns to step 1 if it fails. Server: before anything is written, a manager with no usable password (under 8 characters) is rejected with the returned code `manager_password_required` unless a staff user or an existing Supabase Auth user exists for the email. `provisionManagerAccount` repeats the check and the random-password fallback for `auth.admin.createUser` is deleted. The wizard shows this rejection at step 1.
- **Staff-seeded draft keys.** Connect Discord now always saves the draft, and `saveOnboardingDraft` replaces the whole draft. For manager invites the server keeps the existing `managedGames` and `isPrimaryContact` over anything the browser sends (and removes them if the invite has none), so the browser cannot set them either. Player drafts are untouched. Deviation from the original request: `academicYear` is not locked, because the manager chooses the season in step 1 and the submit-time value already wins; the seed only fills it in when the wizard sends none. Locking it would reset the manager's chosen season after the Discord redirect.
- **Accessibility.** The connected banner sits in an always-mounted `role="status"` region, the Connect buttons use `aria-disabled` (stay focusable) and the "Use a different Discord account" link has a 44px tap target.

## Tests

Pipeline tests (`milestone4-player-wizard.test.ts`): manager success via cookie stores the verified identity; manager without a cookie, with a cookie for another invite, and with `inGuild: false` are rejected and create nothing; a duplicate Discord account is rejected with manager-appropriate wording; legacy draft keys are dropped on save and read. Route tests: start accepts a manager invite and the callback returns to `/join/{school}/manager`. `DiscordStep.test.tsx` asserts no input or honor checkbox.

## Consequences and follow-ups

Existing onboarded managers and players have unverified Discord ids from before OAuth; the owner treats all onboarding data as test data and will purge it, so there is no backfill. A manager whose Discord account is already linked to a player record cannot onboard with that account until the old row is removed. Staff application, careers and school application forms still collect a typed Discord name as plain contact info, and `people.discord`/leadership are untouched; those are not identity claims.

> **Update (28 Oct 2026):** the wizard now starts this flow in a second tab so it keeps its state; see [spec-041](spec-041-discord-oauth-second-tab.md). The same-tab redirect described above remains the fallback when a pop-up is blocked.
