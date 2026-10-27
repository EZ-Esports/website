# spec-038: Discord tier-role sync from roster membership

- **Spec ID:** spec-038
- **Title:** The bot sets per-game Varsity / JV Discord roles automatically when roster membership changes
- **Status:** Implemented on branch `feat/discord-role-sync` (not merged at the time of writing). No migration, no schema change.
- **PR / Commit:** pending
- **Date:** 2026-10-27
- **Issue:** [#249](https://github.com/EZ-Esports/website/issues/249) (part 2: role assignment; the live guild re-check and school roles remain open)
- **Scope:** `DISCORD_TIER_ROLES` config, the pure reconciler, `DiscordRestAdapter` role methods, the sync service, the consumer inside `notifyRosterMembershipChanged`, a staff "Resync Discord roles" action and button, and the `db:sync:discord-roles` backfill script.

## Context & Motivation

Students are added to the EZ Esports server during onboarding (spec-033, spec-035) but staff then handed out Varsity / JV roles by hand. spec-034 added the one-tier-per-game rule and the `notifyRosterMembershipChanged` seam, deliberately a no-op, for exactly this consumer.

Owner's rules: per-game roles ("Valorant Varsity", "Valorant JV", ...); moving a player Varsity to JV removes the Varsity role and adds the JV role; different games are independent; a student removed from every roster loses the tier roles. School roles and the live roster-time guild check are out of scope.

## Rules (the reconciler, `app/lib/onboarding/tier-roles.ts`)

Pure, no I/O. Input is a member's memberships `{gameSlug, rosterName, seasonIsActive, playerRole}` plus the config; output is the set of role ids they should hold.

- **Tier from roster name:** case-insensitive, whitespace-tolerant `Varsity` -> varsity; `JV` or `Junior Varsity` -> jv. Anything else ("Academy", "Varsity 2", "JV Red") grants nothing. The rosters this site creates are named "Varsity" and "JV" (public pages render JV as "Junior Varsity" from the name `JV`).
- **Active season only:** a roster counts only if its season has `seasons.is_active = true` (one per game, enforced by a partial unique index). Past seasons never grant roles, so rolling a season over strips the tier roles of anyone not re-rostered once a resync runs (see open threads).
- **Roles that count:** `player`, `sub`, `captain` (`playerRoleEnum` is `captain | player | coach | sub`). `coach` is excluded: coaches are not students on the roster. Chosen by the brief; confirm with the owner.
- **Unconfigured game or tier:** grants nothing.
- The reconciler does not rely on the one-tier rule; if data held Varsity and JV in one game the member would get both roles.

## Configuration (`DISCORD_TIER_ROLES`)

JSON object keyed by game slug, each tier a role id: `{"valorant":{"varsity":"<id>","jv":"<id>"}}`. Slugs in the code base: `valorant`, `league-of-legends`, `team-fight-tactics`, `osu`, `minecraft`, `tetris`.

- Validated: valid game slug, tier keys only `varsity`/`jv`, ids are snowflakes (17-20 digits), no id used twice across games and tiers.
- Unset, blank or `{}` -> **disabled**, logged once at info, every entry point is a no-op. Malformed -> **disabled**, one error line listing the problems, never a crash; one bad entry disables the whole sync rather than applying half a mapping.
- The **managed set** is exactly the ids in the config. The sync adds or removes only those, so roles staff assigned by hand are never touched.

## Adapter (`app/lib/onboarding/adapters/discord-rest.ts`)

The ambiguous `syncMemberRoles(id, roleIds)` stub on `CommunityPlatformPort` is replaced by `getMemberRoles` (null = 404 = not in the guild), `addMemberRole`, `removeMemberRole` and `syncManagedRoles(id, {managed, desired})`.

- Per-role endpoints only: `PUT` / `DELETE /guilds/{g}/members/{u}/roles/{role}` with the bot token and `X-Audit-Log-Reason: EZ Esports roster sync` (ASCII). The `PATCH` members `roles` array is never used because it overwrites everything the member holds.
- `planRoleChanges(current, {managed, desired})` is the single place that decides the diff: `desired` is clipped to `managed`, and only managed roles currently held can be removed. Adds happen before removes so a move never leaves the member with neither role.
- Errors reuse the existing handling: a short `Retry-After` (<= 3 s) is waited once, then `rate_limited` is surfaced; 401/403 -> `bot_misconfigured` (missing Manage Roles, or the bot's role is below the tier role); 404 on a role endpoint -> `role_not_found` (code 10011, a config error) or `member_not_found` (10007/10013, the user left; `syncManagedRoles` treats this as not in guild); 404 with code 10004 on the member read is an unknown guild, reported as `bot_misconfigured`, not as an absent user.

## Fail closed: preflight (added after review, owner requirement)

The owner has not supplied role ids and the code holds none; it reads only `DISCORD_TIER_ROLES`. The principle: **if the bot cannot assign the roles, assign no roles at all.**

- `checkTierRolesAssignable(managedRoleIds)` on the port/adapter: `GET /users/@me` (bot id), `GET /guilds/{g}/roles`, `GET /guilds/{g}/members/{botId}`. Bot permissions are `@everyone` (role id == guild id) OR every bot role. Requires Administrator (0x8) or Manage Roles (0x10000000); every configured role must exist, not be `managed` (integration), and sit strictly below the bot's highest role position. Reasons: `missing_manage_roles | role_not_below_bot | role_missing | role_is_managed | preflight_failed`. Any failure to complete the check (network, 5xx, 429, 401/403, unreadable body) is `preflight_failed`: it never throws and never passes.
- `runTierRoleSync` calls it once per run before touching any member. A failure returns a `blocked` report (`blockedReason`) with zero reads of members and zero writes, logged once per reason (no ids or tokens). The hook, the staff action and the backfill all go through it; the script's `--execute` refuses, its dry run prints `BLOCKED`.
- Cached in process (module-level, keyed by guild and configured role set): 5 minutes for a pass, 60 seconds for a failure; any 401/403 from a role call invalidates the guild's entries.
- A failure that would repeat for every member (`bot_misconfigured`, `role_not_found`, `rate_limited`) aborts the rest of the run; remaining members are reported as not attempted (`not_attempted_after_config_error` / `not_attempted_after_rate_limit`).
- Order is add before remove, so a partial failure leaves the old role in place; the next sync converges (tested with a fake guild).

## Other review fixes

- **Stale backfill plan.** `--execute` re-reads each student's rosters (one query) just before writing and uses the fresh result; changed plans are logged and counted.
- **Overlapping syncs.** Memberships are read immediately before each member's Discord write; two runs for one member can still finish out of order (last writer wins). Repair: run the resync again (idempotent). Tests show both the "later recompute wins" and the "stale run finishes last" cases.
- **Season rollover guard.** A school-wide resync (and the script) that would leave NO connected student holding a tier role (`stripAll`, from a database-only preview) is refused until confirmed a second time: the server action returns `stripAll` numbers, the UI shows a red second dialog, and the script needs `--allow-strip-all`. Single-member resyncs are not guarded. The preview cannot know who currently holds a role in Discord (no Discord read), so the warning says tier roles "would be removed", not how many.
- **`maxDuration = 60`** exported from the school rosters page (server actions inherit the page's limit; 60 s is the highest every Vercel plan accepts, chosen conservatively); members with no Discord identity no longer cost a pacing pause.
- **404 attribution** on role calls follows Discord's code: 10011 `role_not_found`, 10004 `bot_misconfigured`, 10007/10013 `member_not_found` (user left), anything else (including a non-JSON body) `unknown`.
- **Staff failure rows** show the member's initials plus uuid prefix (`A. L. (5d1f3c3e...)`), resolved server-side; full ids never reach the client.
- **PGlite rehearsal** (`db/__tests__/discord-role-sql-pglite.test.ts`) runs the real Drizzle queries (`loadMemberships`, `loadDiscordUserId`) and the script's raw SQL against the migrations, and proves they agree.

## Sync service

- `tier-role-sync-core.ts`: `runTierRoleSync(memberIds, deps)` with everything injected. Per member, strictly sequential: read the Discord identity (skip if none or not a snowflake), read memberships, compute desired, call `syncManagedRoles`. Failures are isolated per member and logged as a Discord failure code or the error class name only (a database error message can embed query parameters), with a masked id (`first 8 chars...`). Never throws. After a `rate_limited` failure the remaining members are reported as not attempted instead of hammering Discord. Idempotent: a second run with nothing changed makes no write.
- `tier-role-sync.ts` (server only): `syncTierRolesForMembers(ids)` wires the Drizzle reads (`player_identities` provider `discord`, freshest valid snowflake; `players -> rosters -> teams -> seasons -> games`) and the adapter built from `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID` (it does not need the OAuth client keys). Config disabled or Discord env missing -> returns a `disabled` report with no Discord call.
- Report `{status, disabledReason?, synced, unchanged, skippedNoDiscord, notInGuild, failed, failures[{member(masked), reason}]}`, with wording in `tier-sync-report.ts` (client-safe).

## Hook

`notifyRosterMembershipChanged` de-duplicates ids and schedules the sync with `after()` from `next/server` (Next 16: stable, allowed in server actions) so the manager's click returns before Discord is called. With no request scope `after()` throws and the sync runs inline in a try/catch. The function still never throws and its callers are unchanged. The consumer is imported lazily so callers do not load the database client unless a sync runs.

## Staff action and button

- `resyncDiscordRoles(schoolId, memberId?)` in `app/(admin)/admin/schools/[schoolId]/rosters/discord-actions.ts`: `requirePermission(MANAGE_ROSTERS)` (administrators pass inside the helper, like every roster action), validates ids, scopes a single member with `memberInSchool`, and for the whole school loads every member of the school (not only those on a roster, so a student just removed from their last roster still loses the role). Returns `{success: true, report}` or `{success: false, error}`; never throws a message (masked in production), a disabled sync is an explanatory error result.
- UI: `ResyncDiscordRoles` in `SchoolRostersView`, behind `ConfirmActionDialog` through `useConfirmAction` (busy state, in-dialog error), result kept in a `role="status"` panel with counts and masked per-member failures. The action runs inline and waits (so the report is real); a school with many Discord-connected students takes about 150 ms per student plus Discord latency.

## Backfill script (`db/sync-discord-roles.ts`, `npm run db:sync:discord-roles`)

Dry run by default (reads DB + each student's current Discord roles, prints add/remove per student with masked names and ids); `--no-discord-read` skips Discord; `--execute` runs the remote-host gate first (`assertSeedTargetAllowed`), prints the plan, needs the typed phrase `sync-roles <host> <students> <adds> <removes>`, then applies through `syncManagedRoles` (which re-reads live roles) paced at 250 ms with `Retry-After` retries; exit 2 if any student failed. Two database queries, awaited one after the other (the production pooler hangs on pipelined queries, see spec-036 and incident notes). **Written and tested with fakes; not run against production or Discord.**

## Verification

Vitest: `tier-roles.test.ts` (config + reconciler), `discord-rest-roles.test.ts` (adapter with mocked fetch), `tier-role-sync-core.test.ts` (fake DB + fake guild, sequential, idempotent, isolation), `tier-role-sync.test.ts` (disabled/malformed/missing env make zero adapter calls), `roster-membership-events.test.ts` (hook), `resync-discord-actions.test.ts`, `ResyncDiscordRoles.test.tsx`, `db/__tests__/sync-discord-roles.test.ts`. Mutation pass over the guards is recorded in the PR description. No real Discord call and no browser run was made.

## Known limits

- Not seen against a real Discord server. The first real run should be on a throwaway server (see `docs/dev/DISCORD.md`).
- Deleting a game or season, seeds/ingest and `deleteSchoolRoster` do not call the seam (spec-034); use the staff resync or the backfill script after those.
- A student not in the server is skipped; nothing retries them automatically.
