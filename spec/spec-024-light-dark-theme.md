# spec-024 — Public light and dark theme

- **Spec ID:** spec-024
- **Title:** Public light and dark theme
- **Status:** In Progress
- **PR / Commit:** branch `feat/light-dark-mode-v2`
- **Date:** 2026-10-12
- **Scope:** Public site appearance. Staff portal and school manager portal stay dark.

## Context & Motivation

The public site shipped as a single dark appearance. The same behavior merged as #234 and was reverted the same night (`9e9f389`) before review; this branch puts it back unchanged. Light token overrides already existed (`.theme-light`) for the apply forms, but nothing let a visitor choose. The wordmark is white, and several surfaces (the header, photo heroes, photo lightboxes) sit on photographs or on that wordmark, so a naive flip of every pixel would make the chrome unreadable.

## Design Decisions

- **Choice.** The header control is a React Aria button that toggles Light and Dark. The stored value is a cookie, `ez-theme`, and it is only ever `light` or `dark`. No cookie means follow the operating system.
- **Where it is applied.** An explicit choice adds `theme-light` or `theme-dark` on `<html>` during SSR. System adds neither. A `prefers-color-scheme: light` rule in `globals.css` paints the light tokens when the OS is light and the visitor has not chosen dark. There is no boot script.
- **What stays dark.** `.theme-dark` restates the dark tokens. It is on the header (white wordmark, and the bar sits on photographs), photo heroes (`HomeHero`, `AboutHero`, `Hero`), and photo lightboxes (the overlay is portaled, so the class has to be on the overlay). Hero headlines opt out of that light-on-dark type in light mode via `.hero-copy`. The staff shell (`.admin-shell`), its portaled dialogs (`.admin-modal-overlay`, `.admin-popover`), the staff setup error page, and the school manager portal (`.theme-dark` on `PortalShell`) stay dark for the same reason: they hardcode light-on-dark text.
- **Apply forms.** `/apply` and `/apply/staff` keep their own `.theme-light` section, so the form stays a light document when the rest of the site is dark.
- **Foreground that was hardcoded white.** Public headings and labels that sit on token surfaces (careers, leadership initials, bracket tabs) use `text-foreground` / `text-on-accent` so they follow the active tokens. Bracket cards use the same tokens.
- **Photo grade.** Dark mode keeps the live site's grade: the dark vignette and its faint accent blush, not a deeper magenta wash over the photograph. Light mode uses that vignette in white, never thinner than 58% white, so the dark headline and subtitle clear WCAG AA on their own (the white text shadow is not what carries the contrast). `.hero-copy` switches those lines to the dark foreground.
- **Chrome on a light page.** The wordmark and nav stay light-on-dark, so in light mode the header is a solid dark bar instead of sitting transparent on the photograph. Hero buttons use the light-surface accent (`#b5005a`, white label). The pale dark-surface pink fails contrast on the light photo.

## Invariants & Boundaries

- The cookie value is only ever `light` or `dark`. Anything else, including a missing cookie and an older `system` value, follows the operating system. The server never interpolates the cookie into a script.
- The cookie is not `HttpOnly` (the toggle writes it from the browser) and is `SameSite=Lax`, one year, `Secure` only on https.
- Staff portal and school manager portal do not follow the public theme.
- The header and photo lightboxes do not follow the public light tokens. Their type stays light-on-dark, and in light mode the header bar is solid so that type is not drawn on the photograph. Photo-hero headlines and subtitles use the dark foreground in light mode. Hero button labels meet AA against the button fill, and the fill meets the 3:1 boundary against the light photo.
- Reduced motion already collapses the body background/color transition via the global `prefers-reduced-motion` rule.

## Verification

- `npm run test -- app/lib/__tests__/theme.test.ts`
- `npm run lint`, `npm run test`, `npm run build`
- In the browser, on `/`: with no cookie, the page follows the OS. Press the header toggle, confirm it switches between light and dark, the header stays dark, and a reload keeps the choice. In light mode the homepage photograph sits under a white shadow (the inverse of the dark grade) and the headline is dark, not white. Repeat on a narrow viewport. Confirm `/admin` and a careers heading stay readable in Light.
