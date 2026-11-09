# spec-041: Discord OAuth in a Second Tab

- **Spec ID:** spec-041
- **Title:** Verify Discord in a different tab so the wizard keeps its state
- **Status:** Implemented on branch `worktree-agent-ab37714a4c6e7940c`; not pushed. No migration.
- **Date:** 2026-10-28
- **Builds on:** [spec-033](spec-033-discord-oauth-onboarding.md) (player OAuth) and [spec-035](spec-035-manager-discord-oauth.md) (managers).

## Why

The old flow was a full-page redirect: Connect Discord saved a draft, left for Discord, and came back to a freshly mounted wizard. A manager's password is deliberately never saved in the draft, so they had to retype it, and every unsaved field, step and content-screen override ([spec-040](spec-040-onboarding-offensive-content-screen.md)) depended on the draft round trip.

## Flow

1. **Click** (`PlayerOnboardingWizard.handleConnectDiscord`): `window.open('/api/discord/start?token&school&game&popup=1')` runs synchronously inside the click handler (pop-up blockers only allow that). The draft save is fired without awaiting it. The wizard does not navigate, unmount or reset anything.
2. **Start route:** `popup=1` (exactly that value) is stored as `popup: true` in the signed flow cookie (`signFlowCookie`, `DiscordFlowPayload.popup?`). Cookies issued before the field existed verify and behave as same-tab flows. Early exits that redirect to the join page (rate limit, invalid invite, bad Discord config) keep `popup=1`.
3. **Callback route:** unchanged checks (signed state, nonce, invite hash, single-use flow cookie). Every outcome (success and each `discord_error`) redirects to the join page and, when `flow.popup`, adds `popup=1`. The result cookie is set exactly as before (httpOnly, path `/join`, shared by all tabs of the browser).
4. **Join page:** after the usual token validation, `?popup` renders `DiscordPopupDone` instead of the wizard. Success is decided by the signed result cookie (`verified.inGuild` and no `discord_error`), not by the URL; the failure text comes from the fixed `DISCORD_FAILURE_MESSAGES` list. The component tells the wizard tab and tries `window.close()` (it only works for tabs scripts opened; the on-screen "you can close this tab" text is the real fallback).
5. **Wake-up:** `app/lib/onboarding/discord-channel.ts` posts `{ inviteId, status, error? }` on a `BroadcastChannel`, with a `localStorage` write (the `storage` event) as fallback; every call is try/catch-guarded. Listeners ignore other invites' messages and malformed values.
6. **Wizard tab** (review fixes included): while waiting, one server re-check runs at a time (`refreshing`), and each re-check re-tests `finished` after its await. A re-check while the second tab is still open (on window focus, and every 5 s) only completes the wait if the cookie shows an identity *different from the one shown when waiting began*; the old cookie is expected until the new sign-in finishes, so it neither ends the wait nor blanks the identity on screen (a `null` or failed read is ignored the same way). Once the tab has closed (polled every 800 ms) the server's answer is final. A visible **Cancel and stop waiting** button closes the tab we opened and ends the wait, so an expired or missing flow cookie (the callback then shows a plain error page and sends no message) can never trap the person; the ten-minute cap remains. The waiting text lives in the always-mounted `role="status"` region, also while reconnecting with an identity shown. On a wake-up it calls the new server action `getVerifiedDiscordForInvite(token)` (reads the signed cookie via `readVerifiedDiscord`, returns `{ username, inGuild } | null`, never the Discord id) and sets `discord` from that. The message is only a wake-up plus optional display text; it never supplies the identity. Safety nets if no message arrives: the wizard re-checks the server when its window regains focus, and when the other tab's `closed` flips (polled every 800 ms) it stops "connecting" and shows "Discord was not connected" unless the cookie says otherwise. Waiting gives up after ten minutes. Listeners and timers are removed on completion and on unmount.
7. **Blocked tab:** if `window.open` returns null or an already-closed window, or the window reports `closed` on the next tick (some blockers close it immediately), the old behaviour runs: await the draft save, then `window.location.assign` to `/api/discord/start` without `popup`. A same-tab flow is untouched (no `popup` on the way back).
8. **"Use a different Discord account"** uses the same handler. `/api/discord/start` clears the old result cookie, so the wake-up re-read replaces the shown account (or clears it on failure).

Copy: the button reads "Waiting for Discord..." while connecting, with helper text that Discord opens in a new tab, to come back to this one when it says you are connected, and that entries stay as they are.

## Security notes

- **No `noopener` on `window.open`, deliberately.** The wizard needs the returned handle to detect a blocked pop-up (null/closed) and to poll `closed` when the tab is abandoned; `noopener` makes `window.open` return null, which would make every open look blocked. The opener exposure is limited to the pages that tab loads: our own start/callback routes and Discord's sign-in, trusted origins, and the wizard exposes nothing sensitive on `window`. The join page's popup check is `popup === '1'`.
- Identity still comes only from the signed httpOnly cookie. A forged `BroadcastChannel`/`storage` message can only trigger a re-check or show error text in the victim's own browser; it cannot set an identity.
- The flow cookie stays single-use and `popup` lives inside the signed payload, so it cannot be flipped from the URL on the callback.
- `popup=1` on the join page by itself shows only a status page after the same token validation; it grants nothing.

## Tests

`app/api/discord/__tests__/routes-popup.test.ts` (flag stored only for `popup=1`; every callback outcome keeps it; start-route errors keep it; same-tab unchanged; legacy cookie still verifies), `join/.../__tests__/page-popup.test.tsx` (popup branch, cookie not URL decides success, invalid invite unaffected, wizard path unchanged), `discord-popup-done.test.tsx` (page and channel helper incl. storage fallback and blocked storage), `discord-second-tab.test.tsx` (`window.open` synchronous with `popup=1`, draft save not awaited, blocked-tab fallback, identity refreshed from the server action not the message, error text, tab closed early, "different account", unmount cleanup), `verified-discord-action.test.ts`.

Additional review-fix tests (`discord-second-tab.test.tsx`): manager password, fields and content overrides survive a connect with the same wizard instance; double click opens one tab; closed-handle and immediately-closing windows use the fallback; focus re-check with a new identity completes, with the old identity or no cookie changes nothing; one re-check at a time; slow poll; closed tab with a good cookie; ten-minute cap; Cancel; waiting text in the live region.

**Not verified:** real Discord OAuth, real pop-up blocker behaviour, and real cross-tab messaging between two actual browser tabs were not exercised (jsdom and mocks only); not checked in a browser. Behaviour in in-app browsers/webviews that do not support `window.open` or `BroadcastChannel` relies on the fallbacks above.
