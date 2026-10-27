# Discord OAuth setup (player and school manager onboarding)

Players and school managers connect Discord in the join wizard (same flow, same cookies; manager invites use the `manager` game slug); the bot then adds them to the EZ Esports server. Design: `spec/spec-033-discord-oauth-onboarding.md`.

## Environment variables (server only)

| Variable | Description |
| --- | --- |
| `DISCORD_CLIENT_ID` | OAuth2 application id |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret. Also the root of the HMAC key that signs the OAuth state and verification cookies (there is no separate state secret) |
| `DISCORD_BOT_TOKEN` | Bot token of the application's bot user, used for `PUT /guilds/{id}/members/{user}` |
| `DISCORD_GUILD_ID` | Id of the EZ Esports server |

None of these is `NEXT_PUBLIC_`. Set them in Vercel for each environment; ask a core team member for local values.

## Discord developer portal

1. OAuth2 -> Redirects: add `http://localhost:3000/api/discord/callback` for local dev and `https://<your-domain>/api/discord/callback` for each deployed environment (the callback uses the request origin, so it must match exactly).
2. Add the bot to the server with the **Create Instant Invite** permission (required for `guilds.join`). Role assignment is not implemented yet, so no role permissions are needed.
3. Scopes requested from invitees: `identify guilds.join`.

Without these variables the Connect Discord button shows a "problem on our side" message and nobody (players or managers) can finish onboarding.
