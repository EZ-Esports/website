# spec-033: Discord OAuth and automatic server join in the player wizard

- **Status:** Implemented and merged in PR #281 (issue #249 part 1)
- **Date:** 2026-10-26
- **Issue:** [#249](https://github.com/EZ-Esports/website/issues/249) (part 1: identity and join; roles and live re-check remain open)
- **Scope:** `app/lib/onboarding/adapters/discord-rest.ts`, `app/lib/onboarding/discord-verification.ts`, `app/lib/onboarding/discord-session.ts`, `app/api/discord/{start,callback}/route.ts`, `app/lib/onboarding/wizard/submission-pipeline.ts`, `app/lib/onboarding/wizard-actions.ts`, `app/lib/db/onboarding.ts` (`findDiscordIdentityOwner`), the join wizard Discord step.
- **Schema:** none. No migration.

## Why

Step 2 of the join wizard used to take a typed handle plus an "I joined" checkbox, and the pipeline persisted `inGuild: true` unconditionally and, with no id supplied, used the typed handle as the Discord user id. Comp Ops therefore had no proof a player was in the server, and anyone could claim any handle. This replaces that for **players** with real Discord OAuth (`identify guilds.join`) and a bot-driven server join.

## Flow

1. The wizard saves the draft (existing `saveOnboardingDraft`), then navigates to `GET /api/discord/start?token=&school=&game=`.
2. `start` validates the invite with `validateInviteToken` (bad invites are bounced back to the join page; managers were bounced in #281 but are accepted since [spec-035](spec-035-manager-discord-oauth.md)), sets an httpOnly **flow cookie** (`ez_discord_flow`, path `/api/discord`, 10 min, SameSite=Lax, Secure in production) and redirects to Discord. The OAuth `state` carries only the SHA-256 of the invite token and a nonce; the raw token lives only in the flow cookie.
3. Discord redirects to `GET /api/discord/callback`. It requires the flow cookie, a valid state, a state nonce equal to the cookie nonce, and a matching invite hash. The flow cookie is cleared in every callback response, but it is not server-side single-use: replaying a callback needs the same browser's own cookie, and Discord authorization codes are single-use, so a replay cannot complete a second exchange. A state captured in another browser fails the nonce check.
4. On success: exchange the code (`POST /oauth2/token`), `GET /users/@me`, then `PUT /guilds/{guild}/members/{id}` with the bot token and the student's access token (201 joined, 204 already a member). The access token is held in local variables only and discarded.
5. A signed httpOnly **result cookie** (`ez_discord_verified`, path `/join`, 1 hour) records snowflake, username, `inGuild` and invite hash. The student is redirected to `/join/{school}/{game}?token=...&discord=connected` and the wizard resumes at the Discord step, reading the verified username from the cookie on the server (page prop), never from client state.
6. On submit, `submitPlayerOnboarding` reads the result cookie itself (`readVerifiedDiscord`), requires it to match the invite hash, and the pipeline persists its values. Those fields no longer exist on the submission type at all ([spec-035](spec-035-manager-discord-oauth.md)). No valid or unexpired cookie, or `inGuild: false`, rejects the submission. Known rejections (`discord_required`, `discord_not_in_guild`, `discord_already_linked`) are **returned** from the server action as `{success:false, code, error}` (Next masks thrown messages in production); the wizard clears its connected state and sends the student back to the Discord step to reconnect. A unique violation on `player_identities_provider_user_idx` from a race is mapped to the same `discord_already_linked` result, without revealing the owner. Starting a new connection clears the previous result cookie. If the snowflake is already linked to a different member the submission is rejected with a readable error (no schema change; the existing unique index on `(provider, provider_user_id)` is the backstop).

## Signing secret

State and cookies are HMAC-SHA256 signed (timing-safe compare, expiry inside the payload, a `t` kind field so state, flow and result tokens cannot be substituted for each other). The key is derived as `HMAC(DISCORD_CLIENT_SECRET, "ezesports:discord-onboarding:v1")`, so no new env var was added. Rotating the Discord client secret invalidates in-flight state and existing result cookies (students just reconnect).

## Failure modes handled

Consent denied, bad/expired/forged/replayed state, nonce mismatch, rejected authorization code, Discord server cap (error 30001, message points to `discord.gg/ezesports`), banned user (40007), bot misconfigured or missing permission (401/403/404 on join, or missing env vars), rate limit (one inline retry when `Retry-After` is 3 seconds or less, otherwise a retryable message), Discord 5xx and network failure. The callback maps each to a `discord_error` code; the join page turns it into a student-readable message.

## Managers

Superseded by [spec-035](spec-035-manager-discord-oauth.md). #281 left manager invites on the legacy typed handle plus honor-system checkbox; managers now use this same flow and the self-reported path no longer exists.

## Environment

`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`. The redirect URI to register in the Discord developer portal is `{origin}/api/discord/callback` (the request origin is used, so register one per environment). The bot must be in the guild with Create Instant Invite. See `docs/dev/DISCORD.md`.

## CSP

The `proxy.ts` CSP has `form-action 'self'`; the flow uses a script-initiated top-level navigation and a 302 from our own route, not a form post, so no CSP change was needed.

## Not done (out of scope)

Role assignment (`syncMemberRoles` throws "not implemented"), a live re-check of guild membership at roster time, backfill of existing students whose Discord is self-reported, Discord setup on staging/production, and Riot Sign-On (#247). A server-side nonce store (consume-once) would harden the callback against replay. Unexpected thrown errors are still masked by Next in production builds.
