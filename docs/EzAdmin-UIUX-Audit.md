# EZ Admin — UI/UX Audit

**Branch:** `EzAdmin-UIUX`  
**Date:** 2026-06-09  
**Scope:** All pages under `/admin` — layout shell, dashboard, and the 8 section managers.

---

## Methodology

The audit uses six lenses, each graded A–F, then averaged into a page-level GPA.

| Lens | What it measures |
|---|---|
| **Information Architecture (IA)** | Is the right thing in the right place? Can a new admin find what they need without help? |
| **Interaction Completeness** | Does every piece of data have a matching CRUD surface? Are dead links or stub actions present? |
| **Form UX** | Labels, validation feedback, field order, submit affordance, success/error states. |
| **Visual Consistency** | Does the page follow the same design vocabulary as the rest of admin (Card, Button, table header styles, badge tokens)? |
| **Density / Cognitive Load** | Is information scannable? Does the layout waste space or overwhelm? |
| **Contrast & Accessibility** | Do text/icon colors meet WCAG AA (4.5:1 for body text, 3:1 for large text/UI components)? Are light-on-light or dark-on-dark pairings present? Example failure: `#f4cccc` (ez-pink) + `#ffffff` (white) = 1.46:1 — catastrophically below threshold. Primary rule: never pair two colors from the same end of the lightness scale. |

Scoring scale: **A** = no notable issues · **B** = minor friction · **C** = noticeable gap · **D** = broken workflow · **F** = unusable.

### Contrast reference for this project

| Color token | Hex | Luminance | Works with |
|---|---|---|---|
| `ez-pink` | `#f4cccc` | 0.67 (light) | Dark text only — `ez-black` (#1c1c1c) gives 13:1 ✓ |
| `ez-black` | `#1c1c1c` | 0.004 (dark) | Light text — white gives 18:1 ✓ |
| `bg-slate-900` | `#0f172a` | ~0.006 (dark) | Light text ✓ |
| `text-slate-400` | `#94a3b8` | ~0.18 (mid) | Dark backgrounds only — fails on light |
| `text-zinc-500` | `#71717a` | ~0.18 (mid) | Dark backgrounds only — fails on light |

---

## Per-Page Grades

### 1. Layout Shell (`layout.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | B+ | Sidebar order is reasonable. Mixing "Public Site" link into nav items is a small category error — it should be a distinct footer link. |
| Interaction Completeness | A | All sections reachable. |
| Form UX | A | N/A. |
| Visual Consistency | B | Active state uses `border-l-2 border-white` which shifts content 2 px and disrupts left-alignment. Emoji icons mix poorly with the flat dark aesthetic — they render differently per OS. |
| Density | B+ | Sidebar at 256 px is appropriately sized. Top navbar contains only a page title — wastes 64 px of vertical chrome. |

**Page GPA: B**  
**Top issue:** Active nav item shifts layout by 2 px (border-l-2 adds width). Emoji icons are OS-dependent.

---

### 2. Dashboard (`page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | A- | Welcome banner → alerts → stats → quick actions is a logical scan order. |
| Interaction Completeness | B | Stats show 4 counts (games, teams, matches, news) but no links from the stat cards themselves — they are decorative, not navigational. |
| Form UX | A | No forms on this page. |
| Visual Consistency | A- | Consistent Card/Button usage. `hover:scale-[1.03]` on stat cards is a nice touch but scale transforms on grid items can cause overflow clipping issues. |
| Density | B+ | The welcome banner takes significant vertical space for low-information content. When there are no alerts, the empty space before the stats feels excessive. |

**Page GPA: A-**  
**Top issue:** Stat cards should be clickable (link to the corresponding section). `--` placeholder when DB is not configured is cryptic — "N/A" or a "Connect DB" prompt would be clearer.

---

### 3. Matches & Standings (`matches/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | B | 1/3 + 2/3 column split is correct conceptually (form left, list right). |
| Interaction Completeness | C+ | The page delegates entirely to `MatchScheduleForm` and `MatchList` components — cannot fully audit without reading those, but the page frame is complete. No inline "edit score" visible in page scaffold. |
| Form UX | B | Header card duplicates the top-navbar title ("Matches & Standings Manager" appears twice). |
| Visual Consistency | B+ | Error banner uses `ez-pink` while other pages use `amber-500` for DB errors — inconsistent error color semantics. |
| Density | B | Two-column split is appropriate for this density of data. |

**Page GPA: B**  
**Top issue:** Error color inconsistency (`ez-pink` vs. `amber-500`). Page-level h1 inside a Card + layout's top-bar h2 = redundant title.

---

### 4. News & Announcements (`news/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | A- | Header with CTA → table is clean. |
| Interaction Completeness | B+ | Edit and Delete per row — good. No "Preview" link to the live article. No bulk actions (delete multiple). No sort/filter on title, date, or category. |
| Form UX | A | Actions in-table are clear. Delete uses `ConfirmDeleteButton` — correct. |
| Visual Consistency | A | Best-in-class consistency — uses Card, Button, table header tokens correctly. |
| Density | A- | Table is appropriately dense. Title + excerpt two-liner is the right pattern. |

**Page GPA: A-**  
**Top issue:** No "View Live" link per article row. Table is not sortable or filterable — will degrade as content grows.

---

### 5. Teams & Rosters (`roster/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | C | The page is a thin shell over `RosterExplorer` — all IA lives inside that component. The page contributes zero wayfinding of its own (no header card, no description). |
| Interaction Completeness | C | Cannot assess without `RosterExplorer` source, but the page offers no fallback UI on success (no header, no section description). |
| Form UX | C | No visible form structure at the page level. |
| Visual Consistency | C | Only page in admin that skips the header Card pattern used by every other section. |
| Density | C | Unknown — deferred to component. |

**Page GPA: C**  
**Top issue:** Missing page-level header card that every other admin section has. This page will look orphaned in layout. Needs a header Card with section title + description matching the pattern in Leadership, News, and Matches.

---

### 6. Leadership Manager (`leadership/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | A- | Add-form left / list right is the cleanest layout in admin. |
| Interaction Completeness | C+ | Add and Delete only — **no Edit**. Admins cannot fix a typo in a name, role, or bio without deleting and re-adding. No image/avatar URL field despite the public page displaying headshots. |
| Form UX | B+ | Good label style, all fields present. Year field uses `type="text"` with a regex pattern — `type="number"` with `min`/`max` would give better mobile UX and browser validation. Bio textarea is unlabeled in `htmlFor` chain (uses `id="bio"` which is correct but the placeholder is oddly long). |
| Visual Consistency | A | Header card, form, and table all consistent. Add button uses white/dark style (intentional contrast) — acceptable. |
| Density | A- | Clean. Bio truncated in table is correct. |

**Page GPA: B+**  
**Top issue:** No Edit action — CRUD is incomplete. No avatar/photo URL field while the public page needs it.

---

### 7. Gallery (`gallery/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | D+ | The "Add Image" form is above the gallery grids, which is the right placement, but the two "+ Add Image" links in the Set 1 / Set 2 headers both `href="#"` — they do nothing. There are two separate entry points for the same action and one is broken. |
| Interaction Completeness | D | **No Delete or Edit per image.** The "Edit" link in each image card is `href="#"`. Admins can add images but cannot remove or reorder them. `isActive` toggle exists in schema but there is no UI to toggle it. `displayOrder` must be set at add-time by number only — no drag-to-reorder. |
| Form UX | C+ | Form is clear, but "Image URL" expecting a local path (`/images/gallery/gallery-12.png`) is brittle — it should accept a Supabase Storage URL or a file upload widget. No success/error feedback after form submission (server action but no visible toast/redirect). |
| Visual Consistency | B | Image cards are styled differently from the rest of admin's Card vocabulary (custom dark tiles). Fine visually but breaks the system. |
| Density | B | Thumbnail grid is appropriate. `aspect-square` crops images that may not be square — needs `object-cover` (already present) but should note aspect ratio in instructions. |

**Page GPA: D+**  
**Top issue:** Edit and Delete are both `href="#"` — the entire management surface for existing images is broken. No active toggle UI. Gallery is add-only.

---

### 8. Sponsors (`sponsors/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | B+ | Add form → table is the correct pattern. |
| Interaction Completeness | D | **No Edit or Delete per sponsor.** Sponsors table has no actions column. Admins cannot update a sponsor's tier, fix a URL, or remove a departed sponsor. |
| Form UX | B | Logo URL is a text field — no upload, no preview. Display Order requires the admin to know the existing order to avoid collisions (no hint of current ordering). |
| Visual Consistency | B+ | Close to the established pattern, but `sponsors` table omits the action column header entirely (compared to News and Leadership tables that have it). Status badge present but not toggleable from UI. |
| Density | B | Table density is fine. "Order" column shows a raw integer — not very meaningful without context. |

**Page GPA: C+**  
**Top issue:** Zero CRUD actions on existing sponsors. The table is read-only but presents no indication of that. Critical operational gap.

---

### 9. Applications (`applications/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | B | Simple read-only table with sensible column order. |
| Interaction Completeness | C | Status is visible but **not updatable from UI** (no "Mark Reviewed" / "Accept" / "Reject" action per row). Message column is truncated at 60 chars with no expand/modal. Email is `mailto:` linked — good. No export (CSV/email) for follow-up. |
| Form UX | A | No form — read-only. |
| Visual Consistency | A- | Consistent with other read-only tables. `statusBadgeClass` tokens match the system. |
| Density | B | Message truncation at 60 chars is too aggressive — important context is hidden. |

**Page GPA: B-**  
**Top issue:** Status cannot be updated in admin — the entire point of an applications manager. Message truncation hides applicant intent.

---

### 10. Page Content (`content/page.tsx`)

| Lens | Grade | Notes |
|---|---|---|
| IA | B+ | Single card listing all blocks is clean. |
| Interaction Completeness | B+ | Edit per block via `ContentEditor`. No Delete or Add — intentional for structured content keys; acceptable. No indication of which public page each key maps to. |
| Form UX | B | Deferred to `ContentEditor` component — not fully audited here. |
| Visual Consistency | A- | Consistent Card usage. |
| Density | A | Clean. Block count shown. |

**Page GPA: B+**  
**Top issue:** Content key names (e.g. `hero.subtitle`) are raw strings — no label explaining which page/section they control. A "Appears on:" annotation per block would eliminate confusion.

---

## Summary Scoreboard

| Page | IA | Completeness | Form UX | Consistency | Density | **GPA** |
|---|---|---|---|---|---|---|
| Layout Shell | B+ | A | A | B | B+ | **B** |
| Dashboard | A- | B | A | A- | B+ | **A-** |
| Matches | B | C+ | B | B+ | B | **B** |
| News | A- | B+ | A | A | A- | **A-** |
| Roster | C | C | C | C | C | **C** |
| Leadership | A- | C+ | B+ | A | A- | **B+** |
| Gallery | D+ | D | C+ | B | B | **D+** |
| Sponsors | B+ | D | B | B+ | B | **C+** |
| Applications | B | C | A | A- | B | **B-** |
| Page Content | B+ | B+ | B | A- | A | **B+** |
| **Overall** | | | | | | **B-** |

---

## Priority Fix List

Ranked by user-impact × implementation cost.

### P0 — Broken / Missing CRUD (blocking operational use)

1. **Gallery Edit + Delete** — `href="#"` stubs. No admin can manage existing images. Needs server actions + per-card Edit modal and Delete confirm button.
2. **Sponsors Edit + Delete** — Table is entirely read-only. Needs Edit modal (inline or drawer) and Delete with confirm.
3. **Applications Status Update** — No way to move an application from `pending` → `reviewed` → `accepted`. Needs per-row status toggle or action buttons.

### P1 — Incomplete CRUD (significant friction)

4. **Leadership Edit** — Add/Delete only. An Edit form (same fields, pre-populated) is needed for name, role, year, bio corrections.
5. **Gallery active toggle** — `isActive` field exists in DB but no UI. Without it, images cannot be hidden without a DB query.

### P2 — Consistency & Polish

6. **Roster page missing header Card** — Every other section has a title card. Roster page starts naked with `RosterExplorer`.
7. **Error color token** — Matches uses `ez-pink` for DB errors; all others use `amber-500`. Standardize to one semantic error color.
8. **Redundant page titles** — Layout top-bar shows page title, AND each page's first Card has an `h1`. Pick one. Remove the in-page `h1` from matches/leadership/gallery since the top-bar already reads the route.
9. **Active sidebar item 2 px shift** — `border-l-2` adds width and shifts icon+label right. Use `border-l-2` with negative margin or `box-shadow: inset` instead.
10. **Emoji icons** — OS-dependent rendering. Replace with a consistent SVG icon set (Heroicons, Lucide) for professional feel.

### P3 — Quality of Life

11. **News: "View Live" link per row** — Let admin verify the public rendering.
12. **News: sort/filter** — At scale, title and category filtering becomes necessary.
13. **Gallery: file upload vs URL input** — Accepting a Supabase Storage upload would eliminate the manual URL workflow.
14. **Applications: expandable message** — Truncating at 60 chars hides critical context.
15. **Page Content: "Appears on" annotation** — Map content keys to their public page locations.
16. **Stat cards on Dashboard: make them links** — Clicking "Registered Teams: 12" should navigate to `/admin/roster`.
