# spec-035: Discord OAuth for school managers, legacy self-reported Discord removed

- **Status:** Implemented, unmerged (branch `feat/manager-discord-oauth`)
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
- **Wizard.** `DiscordStep` is Connect Discord only (no text input, checkbox or `isManager` split). `useWizardDraft`, `types.ts`, `PlayerOnboardingWizard`, `SuccessStep` (name from the verified identity) and the page props lost the old state. `validateStep2` requires the verified state for everyone. Managers use the same five steps, and resume at step 2 after the OAuth redirect (`resumeAtDiscord`).

## Tests

Pipeline tests (`milestone4-player-wizard.test.ts`): manager success via cookie stores the verified identity; manager without a cookie, with a cookie for another invite, and with `inGuild: false` are rejected and create nothing; a duplicate Discord account is rejected with manager-appropriate wording; legacy draft keys are dropped on save and read. Route tests: start accepts a manager invite and the callback returns to `/join/{school}/manager`. `DiscordStep.test.tsx` asserts no input or honor checkbox.

## Consequences and follow-ups

Existing onboarded managers and players have unverified Discord ids from before OAuth; the owner treats all onboarding data as test data and will purge it, so there is no backfill. A manager whose Discord account is already linked to a player record cannot onboard with that account until the old row is removed. Staff application, careers and school application forms still collect a typed Discord name as plain contact info, and `people.discord`/leadership are untouched; those are not identity claims.
