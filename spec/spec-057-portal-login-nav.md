# spec-057: Portal login nav bar

Status: implemented, unmerged. No migration.

## What changed
`/portal/login` (School Manager login) had a bare centered card with no navigation. It now renders the same site-wide `Header` (`app/components/layout/Header.tsx`) that the marketing pages use, so the login page has the regular public-site nav (Competition, About, Get Involved, Submit Interest).

- The page renders `<Header />` above its body. `Header` is fixed, so the `<main>` takes `pt-[88px]`, matching `MainContentWrapper`.
- The school selector, user badge and sign-out from `PortalShell` are not shown, because the visitor is logged out.
- The manager card no longer has a link to the staff login. The staff login (`app/(marketing)/login/page.tsx`) gained a footer link to the Manager Portal Login instead, so each login links to the other.

## Layout
The outer element is a plain `div` holding the header, a `<main>` with `min-h-screen flex items-center justify-center px-4 pt-[88px]`, and the shared `Footer`. The `<main>` fills the viewport below the fixed header, so the card is centered in the visible area. The footer sits below the fold and appears on scroll. The card keeps its size (`w-full max-w-md`) and the form is unchanged.

## Why
Logged-out managers landed on a page with no way back to the public site. Using the shared `Header` keeps the login page's navigation identical to every other public page, rather than a second, portal-specific bar that would drift from it.

## Files
- `app/(portal)/portal/login/page.tsx`
- `spec/spec-057-portal-login-nav.md`, `spec/README.md`, `spec/timeline.md`
