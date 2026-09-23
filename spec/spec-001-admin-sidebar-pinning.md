# spec-001: Pinned Admin Sidebar

- **Status:** Shipped
- **PR:** #187 (`875bf56`)
- **Date:** 2026-09-23
- **Scope:** `app/(admin)/admin/AdminShell.tsx`

## Context & Motivation

In the staff CMS (`/admin`), the left navigation sidebar previously stretched to the full height of the tab content within the root flex container. On tall admin pages (e.g. applications, rosters, matches), the utility links at the bottom of the sidebar (`Public Site` and `Sign Out`) were pushed below the visible viewport, requiring full-page scrolling to access them.

## Design Decisions

1. **Pin Sidebar to Viewport:**
   - Position the `<aside>` element with `sticky top-0 h-dvh self-start`.
   - Using `h-dvh` accounts for dynamic browser viewports and mobile address bars.
   - The document body is the scroll container; the sidebar remains anchored to the viewport height.

2. **Static Navigation Layout:**
   - Style the `<nav>` container with `min-h-0 overflow-hidden` and tightened vertical padding (`py-3`).
   - Keeps the main navigation items visible from the top while anchoring `Public Site` and `Sign Out` permanently to the bottom of the viewport.

## Invariants & Boundaries

- The admin shell relies on the browser window for page scrolling; the sidebar does not stretch with page content.
- Utility footer links remain accessible within the viewport on all admin routes.
- Responsive note: The admin shell targets desktop viewports; there is currently no mobile slide-out drawer.

## Verification

- TypeScript compilation (`npx tsc --noEmit`)
- ESLint checks (`npm run lint`)
- Production build validation (`npm run build`)
- Visual verification across tall admin views
