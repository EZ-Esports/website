# spec-012: Admin Control Panel Navigation

- **Status:** In Review
- **PR:** TBD (branch `feat/admin-control-panel-nav`)
- **Date:** 2026-10-02
- **Scope:** `app/lib/admin-nav.ts`, `app/components/admin/AdminSidebarNav.tsx`, `app/components/admin/AdminControlPanel.tsx`, `app/(admin)/admin/AdminShell.tsx`, `app/(admin)/admin/page.tsx`, tests in `app/lib/__tests__/admin-nav.test.ts`, `app/components/admin/__tests__/AdminSidebarNav.test.tsx`, `app/(admin)/admin/__tests__/page.test.tsx`

## Context & Motivation

The staff portal sidebar was a flat list of 13 links in no particular order (League Setup next to News next to Leadership next to Applications). Staff had to scan the whole list to find a page, and the list was too tall for a 768px laptop viewport: with spec-001's `overflow-hidden` nav, the bottom links were clipped and unreachable there. The Overview page offered three hard-coded "Quick Actions" (matches, news, roster) that ignored the rest of the portal.

The user asked for the Windows Control Panel "Category" view: a few categories, each a collapsible group of its pages, and an Overview that works as a hub. We copied the information architecture, not the light Windows theme.

## Design Decisions

1. **One shared nav definition (`app/lib/admin-nav.ts`).** `ADMIN_NAV_CATEGORIES` holds each category's id, label, icon, one-line description, items (label, `AdminSectionHref`, icon, description). The sidebar and the Overview both read it, so they cannot drift. The module is client-safe: it imports only a *type* from `staff-access`.

   | Category | Items |
   |---|---|
   | (standalone) | Overview `/admin` |
   | People & Staffing | Applications, Roles & Staff, Leadership Manager |
   | League Operations | League Setup, Matches & Standings, Standings Archive, Teams & Rosters, Schools |
   | Website Content | News & Announcements, Gallery, Sponsors, Page Content |

2. **Pure, tested helpers in the same module.**
   - `filterAdminNav(allowedHrefs)` keeps the items whose href is in `allowedHrefs` (from `getAllowedAdminHrefs`), then drops any category left with no items.
   - `isAdminHrefActive` matches Overview only on `/admin`, and a section on itself or anything nested under it (`/admin/news/new` → News, but `/admin/newsletter` is not News).
   - `findActiveAdminNav` returns the most specific matching item and its category.
   - `getAdminBreadcrumb` produces the top-bar trail. It reads the **full** nav, so a page the viewer cannot use still names itself above its permission-denied notice. Nested titles (`New Article` and `Edit Article` under News) are kept.

3. **Sidebar disclosures (`AdminSidebarNav`).** RAC `DisclosureGroup` (`allowsMultipleExpanded`, controlled `expandedKeys`), one `Disclosure` per category. The trigger is a RAC `Button slot="trigger"`, which provides `aria-expanded` and `aria-controls`, plus Enter/Space handling. The panel is a labelled `role="group"` and is `hidden` when collapsed, so its links leave the tab order. The triggers are not wrapped in headings, which follows the WAI disclosure-navigation pattern and keeps the sidebar out of the page's heading outline.
   - The category that holds the active route starts open, and it opens again whenever the pathname changes. This is done by adjusting state during render, keyed on pathname, not by a syncing effect.
   - Its header stays white and bold, with an accent icon, an accent dot and screen-reader text ("contains the current page"), even when collapsed.
   - Active links carry `aria-current="page"` and keep the old accent style (`bg-accent/5`, `border-accent`, bold, accent icon).
   - Open/closed state is **not** persisted. On a full page load of Overview every category starts collapsed, because the hub on the page already shows everything. The shell lives in the layout, so after client navigation back to Overview any categories that were open stay open.

4. **Top bar breadcrumb.** `Staff Portal › Category › [Section ›] PAGE`, where the root and section are links and the page title is still the `h2`. It reads like the Control Panel address bar.

5. **Overview hub (`AdminControlPanel`).** A compact "Control Panel" section below the stat cards, with the welcome banner, awaiting-role state, alerts and stat cards unchanged above it. It uses a three-column grid at `xl:` (two at `md:`, one below) with one `padding="sm"` card per permitted category: a small icon tile, title, one-line description, then a small "Quick links" label over each permitted section as an accent-text link with an always-visible leading arrow (`min-h-7`, underline and arrow nudge on hover, section description as a `title` tooltip), the way Control Panel lists sub-links under a category. A verb-led label per section ("Review applications") was tried and reverted at the user's request; links use the section names.

6. **No separate quick actions.** An earlier iteration listed "common tasks" under each category, but 11 of 15 went to the same page as a section link right above them (and two pairs shared one URL under different verbs), so they promised actions they didn't perform. They were removed along with the `actions` field, at the user's direction; the old three-item Quick Actions card is gone too. If task shortcuts come back, they must be real deep links (add the anchor or query param to the target page first) gated by the target page's section.

7. **Nav scroll (amends spec-001).** The nav is `overflow-y-auto overscroll-contain` instead of `overflow-hidden`. All categories expanded is about 720px from the top of the sidebar, which fits at 1440×900 and at 1080p. On short viewports such as 1366×768, the nav scrolls on its own while Public Site and Sign Out stay pinned (before, the flat list was clipped there). The nav uses the `.admin-scroll` scrollbar in `globals.css` (6px, transparent track, `--line` thumb, accent on hover; renamed from `.admin-nav-scroll` in [spec-013](spec-013-staff-portal-ui-overhaul.md) because scrolling admin lists share it). It must not set `scrollbar-width`/`scrollbar-color` directly: in Chromium those disable `::-webkit-scrollbar` styling and bring back the browser default, so they are only an `@supports not selector(::-webkit-scrollbar)` fallback.

8. **Dropdown motion.** `DisclosurePanel` animates `height` from RAC's `--disclosure-panel-height` (RAC measures the panel, transitions it in pixels, then switches to `auto`). While opening, a thin accent-to-line guide rail draws down in the gutter left of the items (`scale-y`, clear of the active-item highlight) and items fade and slide in on a stagger (`60ms + 45ms × index`); on close they leave together. The chevron rotates and turns accent when open. Everything has `motion-reduce:transition-none`. The active-category dot sits on the category icon's corner so "League Operations" stays on one line.

## Invariants & Boundaries

- Every `ADMIN_SECTION_PERMISSIONS` key appears in exactly one category, and a test enforces this. Adding a section means adding it to `ADMIN_NAV_CATEGORIES`.
- Navigation filtering is cosmetic. Pages and server actions keep their own `getStaffForAdminSection` / `requirePermission` checks.
- The sidebar stays `sticky top-0 h-dvh self-start` (spec-001). Only the nav scrolls, never the footer links.
- **Compact-density exception to the `ui` skill's 44px tap-target rule.** The staff portal is desktop-only (no mobile drawer, spec-001), and the user asked for a compact hub. Sidebar sub-item links (`min-h-9`), hub section links (`min-h-7`) and breadcrumb links are intentionally below 44px. Top-level sidebar rows (Overview, category triggers) stay `min-h-11`. Do not "fix" these back to 44px without revisiting the compact layout; if a mobile layout is ever added, it must restore 44px targets.
- Non-goals: mobile drawer, persisted expand state, category landing pages (category titles on the hub are headings, not links).

## Verification

- `npx vitest run app/lib/__tests__/admin-nav.test.ts app/components/admin/__tests__/AdminSidebarNav.test.tsx "app/(admin)/admin/__tests__/page.test.tsx"` (26 tests).
- `npm run test`: 877 passed and 6 skipped. 1 failed: the pre-existing Windows-only `db/__tests__/backup.test.ts` path-separator failure.
- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`.
- Visual: the live `/admin` is auth-gated and was not logged into. Instead, the real `AdminShell` and Overview page were rendered with mocked staff and query data, using the built Tailwind CSS. Headless Chrome screenshots were taken at 1440×900, 1366×768 and 1920×945 to check: the hub grid; the sidebar collapsed, active-expanded and all-expanded; and the breadcrumb on `/admin/news/new`.
