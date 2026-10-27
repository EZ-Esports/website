# Discord OAuth setup (player and school manager onboarding)

Players and school managers connect Discord in the join wizard (same flow, same cookies; manager invites use the `manager` game slug); the bot then adds them to the EZ Esports server. Design: `spec/spec-033-discord-oauth-onboarding.md`.

## Environment variables (server only)

| Variable | Description |
| --- | --- |
| `DISCORD_CLIENT_ID` | OAuth2 application id |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret. Also the root of the HMAC key that signs the OAuth state and verification cookies (there is no separate state secret) |
| `DISCORD_BOT_TOKEN` | Bot token of the application's bot user, used for `PUT /guilds/{id}/members/{user}` |
| `DISCORD_GUILD_ID` | Id of the EZ Esports server |
| `DISCORD_TIER_ROLES` | Optional. JSON map of game slug to tier to role id; turns on the tier role sync (below) |

None of these is `NEXT_PUBLIC_`. Set them in Vercel for each environment; ask a core team member for local values.

## Discord developer portal

1. OAuth2 -> Redirects: add `http://localhost:3000/api/discord/callback` for local dev and `https://<your-domain>/api/discord/callback` for each deployed environment (the callback uses the request origin, so it must match exactly).
2. Add the bot to the server with the **Create Instant Invite** permission (required for `guilds.join`). For tier roles also grant **Manage Roles** (see "Tier roles" below).
3. Scopes requested from invitees: `identify guilds.join`.

Without these variables the Connect Discord button shows a "problem on our side" message and nobody (players or managers) can finish onboarding.

## Tier roles (Varsity / JV per game)

When a student is enrolled, removed, moved or has their role changed on a roster, the bot sets their per-game tier roles automatically ([spec-038](../../spec/spec-038-discord-role-sync.md)). School roles are not handled.

Rules: the roster named "Varsity" grants that game's Varsity role, "JV" (or "Junior Varsity") grants its JV role, any other roster name grants nothing. Only rosters in the game's **active season** count. Players, subs and captains get the role; coaches do not. A student on no roster loses the tier roles. Moving Varsity to JV removes the Varsity role and adds the JV role. Roles that are not in `DISCORD_TIER_ROLES` (Captain, Coach, school roles, anything staff gave by hand) are never added or removed.

### Setup

1. In the Discord server create one role per game and tier, for example "Valorant Varsity", "Valorant JV", "League of Legends Varsity", "League of Legends JV". Give them no permissions (they are labels); keep them free of dangerous permissions such as Administrator, Manage Roles or Manage Server.
2. Server Settings -> Advanced -> turn on **Developer Mode**. Then Server Settings -> Roles, right-click each role -> **Copy Role ID**.
3. Give the bot the **Manage Roles** permission and drag the bot's own role **above** every tier role in the role list. Discord only lets a bot manage roles below its highest role; otherwise every change fails with 403.
4. Set `DISCORD_TIER_ROLES` (one line, in Vercel and locally) using the game slugs from the `games` table:

```json
{"valorant":{"varsity":"111111111111111111","jv":"222222222222222222"},"league-of-legends":{"varsity":"333333333333333333","jv":"444444444444444444"}}
```

Slugs the site uses: `valorant`, `league-of-legends`, `team-fight-tactics`, `osu`, `minecraft`, `tetris` (see `GameSlug` in `app/types/index.ts` and `sharepoint/normalize_gold.py`). Only Varsity/JV games need entries. A game or tier left out simply grants nothing.

The value is validated: every id must be a 17-20 digit string, tier keys are `varsity` and `jv` only, and no role id may appear twice. **Unset or empty turns the sync off** (every entry point is a quiet no-op). **A malformed value also turns it off** and logs `Discord tier role sync is DISABLED: invalid DISCORD_TIER_ROLES ...` once; it never crashes a roster action.

Students must have connected Discord in onboarding (the sync reads `player_identities`) and be in the server. A student who is not in the server is skipped and counted; they get the roles the next time their roster changes or a resync runs.

### Staff resync

Admin -> Schools -> a school -> Rosters has **Resync Discord roles** (needs the Manage Rosters permission). It re-derives every member of that school and reports how many were updated, already correct, not in the server, without Discord, or failed (failures show a masked member id and a reason such as "The bot lacks Manage Roles, or its role is below the tier roles").

### Backfill script

`npm run db:sync:discord-roles` catches up everyone at once (for example the first time you turn this on). It is **read-only by default**:

```
npm run db:sync:discord-roles                         # dry run: reads the DB and current Discord roles, prints the diff
npm run db:sync:discord-roles -- --no-discord-read    # dry run without Discord: just the desired roles
npm run db:sync:discord-roles -- --execute            # applies the diff
```

`--execute` needs the remote-host gate (`SEED_ALLOW_REMOTE=<exact hostname>` when `DATABASE_URL` is not loopback), then asks you to type a phrase naming the host and the counts. Output is masked (initials, truncated ids). Database queries run one at a time (the production pooler hangs on pipelined queries) and Discord calls are paced with 429 handling. Exit code 2 means it finished but some students failed. The script reads `.env`, which points at production here: confirm before running it.

### Trying it on a throwaway server

Use a scratch Discord server and a scratch or local Postgres, never production. Create the roles, copy the ids, set `DISCORD_TIER_ROLES`, `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in `.env.local`, make a student whose `player_identities` row holds your own Discord user id, put them on a Varsity roster of the active season, then move them to JV from the portal. The server audit log shows "EZ Esports roster sync" for each change.
