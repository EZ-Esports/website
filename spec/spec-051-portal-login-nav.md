# spec-051: Portal login nav bar

Status: implemented, unmerged. No migration.

## What changed
`/portal/login` (School Manager login) had a bare centered card with no navigation. It now renders the same site-wide `Header` (`app/components/layout/Header.tsx`) that the marketing pages use, so the login page has the regular public-site nav (Competition, About, Get Involved, Submit Interest).

- The page renders `<Header />` above its body. `Header` is fixed, so the `<main>` takes `pt-[88px]`, matching `MainContentWrapper`.
- The school selector, user badge and sign-out from `PortalShell` are not shown, because the visitor is logged out.
- The card's own footer link to Staff Portal Login stays.

## Layout
The outer element is a `div` (`min-h-screen flex flex-col`) holding the header and a `<main>` with `flex-1 flex items-center justify-center px-4 pt-[88px] pb-12`. The card is centered horizontally and vertically in the area below the fixed header and keeps its size (`w-full max-w-md`). The form and its contents are unchanged.

## Why
Logged-out managers landed on a page with no way back to the public site. Using the shared `Header` keeps the login page's navigation identical to every other public page, rather than a second, portal-specific bar that would drift from it.

## Files
- `app/(portal)/portal/login/page.tsx`
- `spec/spec-051-portal-login-nav.md`, `spec/README.md`, `spec/timeline.md`
