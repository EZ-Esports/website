# spec-051: Portal login nav bar

Status: implemented, unmerged. No migration.

## What changed
`/portal/login` (School Manager login) had a bare centered card with no navigation. It now renders a top bar that matches the manager portal header in `PortalShell`:

- Sticky `<header>` with the same surface, blur and border tokens as the portal shell.
- "EZ ESPORTS" logo link to `/` (public site) and the "Manager Portal" pill in `#f4cccc`.
- A compact `<nav aria-label="Portal login">` with one link to the Staff Portal login at `/login`.
- No school selector, user badge or sign-out, because the visitor is logged out.

The card's own footer link to Staff Portal Login stays.

## Layout
The outer element is now a `div` (`min-h-screen flex flex-col`) holding the header and a `<main>` with `flex-1 flex items-center justify-center px-4 py-12`. The card is centered horizontally and vertically in the area below the bar and keeps its size (`w-full max-w-md`). The form and its contents are unchanged.

## Why
Logged-out managers landed on a page with no way back to the public site. The header matches the portal's look so the login and the portal read as one product.

## Files
- `app/(portal)/portal/login/page.tsx`
- `spec/spec-051-portal-login-nav.md`, `spec/README.md`, `spec/timeline.md`
