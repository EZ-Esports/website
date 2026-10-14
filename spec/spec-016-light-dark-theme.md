# spec-016 — Public light and dark theme

- **Spec ID:** spec-016
- **Title:** Public light and dark theme
- **Status:** In Progress
- **PR / Commit:** PR #226
- **Date:** 2026-10-12
- **Scope:** Public site appearance. Staff portal and school manager portal stay dark.

## Context & Motivation

The public site shipped as a single dark appearance. Light token overrides already existed (`.theme-light`) for the apply forms, but nothing let a visitor choose. The wordmark is white, and several surfaces (the header, photo heroes, photo lightboxes) sit on photographs or on that wordmark, so a naive flip of every pixel would make the chrome unreadable.

## Design Decisions

- **Choice.** A header control (React Aria `Select`) offers Light, Dark, and System. The stored value is a cookie, `ez-theme`. No cookie means Dark, which is the site's designed appearance — System is an explicit choice, not the default.
- **Where it is applied.** An explicit Light choice adds `theme-light` on `<html>` during SSR. A blocking script in `<head>` (CSP nonce from `x-nonce`) applies the same rule before paint, which is what resolves System, because the server cannot see the OS preference. `suppressHydrationWarning` on `<html>` covers that one class difference.
- **What stays dark.** `.theme-dark` restates the dark tokens. It is on the header (white wordmark, and the bar sits on photographs), photo heroes (`HomeHero`, `AboutHero`, `Hero`), and photo lightboxes (the overlay is portaled, so the class has to be on the overlay). The staff shell (`.admin-shell`), its portaled dialogs (`.admin-modal-overlay`, `.admin-popover`), the staff setup error page, and the school manager portal (`.theme-dark` on `PortalShell`) stay dark for the same reason: they hardcode light-on-dark text.
- **Apply forms.** `/apply` and `/apply/staff` keep their own `.theme-light` section, so the form stays a light document when the rest of the site is dark.
- **Foreground that was hardcoded white.** Public headings and labels that sit on token surfaces (careers, leadership initials, bracket tabs) use `text-foreground` / `text-on-accent` so they follow the active tokens. Bracket cards use the same tokens.

## Invariants & Boundaries

- The cookie value is only ever `light`, `dark`, or `system`. Anything else is treated as dark, on the server and in the boot script. The script never writes the cookie value into the DOM.
- The cookie is not `HttpOnly` (the boot script has to read it) and is `SameSite=Lax`, one year, `Secure` only on https.
- Staff portal and school manager portal do not follow the public theme.
- Photo heroes and the header do not follow the public light tokens. Their type stays light-on-dark.
- Reduced motion already collapses the body background/color transition via the global `prefers-reduced-motion` rule.

## Verification

- `npm run test -- app/lib/__tests__/theme.test.ts`
- `npm run lint`, `npm run test`, `npm run build`
- In the browser, on `/`: open the header theme control, choose Light, confirm the page surface turns light, the header and hero type stay light-on-dark, and a reload keeps Light. Choose Dark and confirm the previous appearance. Choose System and confirm it follows the OS. Repeat the control on a narrow viewport. Confirm `/admin` and a careers heading stay readable in Light.
