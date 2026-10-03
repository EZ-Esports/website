# spec-013: Staff Portal UI Overhaul (calmer surfaces, page anatomy, motion, accent rules)

- **Status:** In Review
- **PR:** TBD (branch `feat/admin-control-panel-nav`, on top of [spec-012](spec-012-admin-control-panel-nav.md))
- **Date:** 2026-10-02
- **Scope:** presentation only, everything under `app/(admin)` and `app/components/admin`, plus `admin-*` classes and the `--admin-panel` token in `app/globals.css`. New files: `app/components/admin/AdminUI.tsx`, `app/components/admin/AdminTabs.tsx`, `app/components/admin/NewsStatusBadge.tsx`.

## Context & Motivation

The user asked to make the staff portal "more fancy and simple to use", and picked **more motion** plus **cleaner and calmer** (not glassy, not gradient-heavy). Before this change every admin page invented its own header (some a bordered card with an `h1`, some only the breadcrumb `h2`), its own label style (uppercase `text-[10px] tracking-wider` in five variants), its own input class (`bg-[#111111]` copied into six files), its own toast (inline banner on some pages, fixed toast on another), and boxes nested in boxes (`Card` with `border-l-4 border-l-accent` wrapping a bordered table wrapping bordered rows). Row actions were hover-gated on two pages. Several labels were not associated with their inputs.

Mid-build the user said the first calm pass was "a bit too simple" and asked for some pink back. The result keeps the calm structure and spends the brand pink (`--accent`, `#f4cccc`) on emphasis and state only (rules below).

## Design Decisions

### 1. Tokens (`app/components/admin/styles.ts`, `globals.css`)

- **Surfaces, three steps, no borders by default:** page `bg-surface`, panel `bg-admin-panel` (new opaque token `--admin-panel: color-mix(surface-raised 60%, surface)`, mapped to `--color-admin-panel`), fields `bg-surface-sunken`. Opaque on purpose so sticky toolbars and the sidebar can sit on it. Borders are hairlines (`border-line/60`) for dividers and input outlines only.
- **Type scale (sentence case for UI copy; nav names keep the nav's casing):** headings are big and bold (the portal read as empty with light weights): page title `text-3xl font-black` in white with a 4px accent rule, eyebrow `text-xs font-bold uppercase tracking-widest` in accent, section title `text-lg font-black`, empty-state title `text-xl font-black`, Overview stat value `text-4xl font-black`, table headers `text-[11px] font-bold uppercase tracking-widest`, Overview quick links `font-bold`. Form labels, helper text and body copy stay calm and sentence case: field label `text-[13px] font-medium text-foreground-secondary` (`label`, `labelText`), helper `text-xs text-foreground-secondary` (`helpText`), inline error `text-xs font-medium text-danger-on-tint` (`fieldError`). `foreground-muted` measures 3.7:1 on the panel and 4.1:1 on sunken fields, so it is only for placeholders, decorative icons and chevrons; any readable content (counts, "Not published", "Locked", "(empty)", timestamps, empty-cell dashes) uses `foreground-secondary`.
- **Buttons:** `adminButton(tone, size)` with tones `primary` (accent), `secondary`, `ghost`, `danger` and sizes `md` (36px) / `sm` (32px); named exports `primaryBtn`, `secondaryBtn`, `ghostBtn`, `dangerBtn`, `*Sm`. All share a 0.97 press scale and `focusRing`. Row actions keep the spec'd 32px family and hit-area rules (`editIconBtn`, `saveBtn`, `cancelBtn`, `deleteIconBtn`, `deleteIconBtnCompact`); `cancelBtn` is now borderless-quiet and text buttons are sentence case.
- **Fields:** `input` (36px), `inputSm` (32px, toolbar search), `selectClass` (32px toolbar select; it sets the shared chevron inset vars, and the Match Fixtures status select swaps them for its tighter values).
- **Links:** `textLink` (14px) and `textLinkSm` (12px, table cells).
- **Chips:** `chip(tone, size)` and `chipButton(tone, size)` with tones `neutral`, `ghost`, `accent`, `success`, `warning`, `danger`, `info`, `violet`; `chipDot` for a leading dot. Status toggles (Active/Inactive) are `chipButton`s.
- **Tables/lists:** `table`, `theadRow`, `th`, `thRight`, `td`, `tdRight`, the compact `thCompact`/`tdCompact` (+`Right`) variants (px-2, `first:pl-4 last:pr-3`) for tables in narrow columns, `tbody` (includes `admin-stagger`), `tr` (hover tint plus a 2px inset accent edge on the first cell), `trEditing`, `listStack`, `cardHover` (lift + accent ring for clickable cards), `segmentedGroup` / `segmentedItem(active)`.
- **Avoid same-property overrides.** Appending `h-5` to a class that already has `h-6` (or `text-xs` onto `text-sm`) has undefined order in Tailwind v4 output. Use the size parameters and variants above instead.

### 2. Primitives (`AdminUI.tsx`, no hooks, no `'use client'`)

`AdminPage` (section rhythm + route-entry motion), `AdminPageHeader` (`route`, `eyebrow`, `title`, `description`, `actions`, `back`, `meta`), `AdminSection` (`variant` `panel` | `flush` | `bare`, optional `toolbar` and `stickyToolbar`), `AdminCount`, `AdminEmptyState` (icon, one sentence, optional description and action; `titleAs="h1"` for full-page states), `AdminNotice` (`info` | `success` | `warning` | `danger`, inline, optional dismiss), `AdminToast` (floating bottom-right save feedback), `AdminSkeleton` / `AdminSkeletonRows`, `AdminSpinner`, `PendingLabel`, `RequiredMark`, `AdminField`, `AdminFormActions`, `AdminFilterTabs` (URL-driven Links with `aria-current`), `AdminSearchField` (leading icon, optional clear button; controlled with `onClear`, or uncontrolled in a GET form, so server pages can use it; used in all eight search boxes).

`AdminPageHeader` takes `route` and derives the eyebrow (sidebar category) and title (nav label, or the nested title such as "New Article") from `getAdminBreadcrumb`, so the header always uses the same names and casing as the sidebar and breadcrumb; `title`/`eyebrow` override (Overview only). `AdminEmptyState` takes `tone` (`accent` | `danger` | `warning`) for the icon tile and `alert` to announce only the description; full-page states (`PermissionDenied`, `error.tsx`) put `role="alert"` on the message, not on the section with its heading and buttons. `AdminSection`'s `stickyToolbar` pins only the toolbar row (a direct child of the section), so the title scrolls away and less of a 768px screen is lost.

`AdminTabs.tsx` (client): `AdminTabs`/`AdminTabList`/`AdminTab`/`AdminTabPanel` (RAC Tabs, `underline` or `pill`) and `AdminSegmented` (RAC `RadioGroup` of `RadioField` + `RadioButton`). Both use RAC `SelectionIndicator`, which measures the old and new position and glides via a `translate`/`width` transition. **RAC 1.19 gotcha:** the legacy `Radio` does not provide the indicator context; only `RadioField` does, so the indicator sits beside the `RadioButton` inside the field. `AdminSegmented` must render outside any `<form>` (radios carry a generated `name`).

### 3. Page anatomy

Every page is `AdminPage` → `AdminPageHeader route=…` (one `h1` = nav label, accent eyebrow = sidebar category, accent rule under the title, primary action on the right when the page has a page-level one) → `AdminSection`s. The top-bar breadcrumb's current crumb became a plain `span aria-current="page"` (it was an `h2` in spec-012) because each page now owns its `h1`. Inline-create pages (Schools, Sponsors, Gallery, League Setup, Matches, Leadership) keep their create form as the first section ("Add a school", form submit bottom-right) rather than moving it behind a header button: that would need modal open/close-on-success behaviour.

Per page: Overview (header + "View public website", alerts as notices, stat cards with accent icon tiles and hover lift, hub cards with accent hover ring), Applications (two flush sections with sticky status filters + export, compact single-line status chips, pending in accent), Roles & staff (RAC tabs with gliding underline, pill sub-tabs, members/invites as hairline lists, roles split pane with keyboard-reachable role buttons and always-visible reorder arrows), Leadership (add-officer panel with `AdminSegmented` mode switch, officers table with sticky search + year segmented control, counts in header meta), League setup (games/seasons panels with an add strip and hairline rows, actions always visible, floating toast), Matches (sticky "Schedule a match" panel capped at `100dvh-6rem` with its own scroll so its submit stays reachable, fixtures section with sticky filter toolbar and compact cells, skeleton/dimmed loading, text-only "Saving…" on row save), Standings archive (sticky scope toolbar with division segmented control and "Add row" toggle), Teams & rosters (sticky drill-down breadcrumb/season bar, level headers as `h2`, tiles whose wrapper carries `cardHover` so hovering the corner trash keeps the lift, inline panels that fade in, skeleton loading), Schools / Sponsors (add panel + flush table, associated labels, active chips), Gallery (cards with hover lift and image zoom, no lift while the edit form is open, aria-disabled reorder arrows, centred unsaved-order bar), News list (header "Write article", sticky status tabs + search, pending submit buttons), News new/edit (back link, status chip in header meta, "View live" and "Unpublish post" as header actions), Page content (one panel per block titled with an `h2` directly under the page `h1`, history as a RAC Disclosure that slides open).

States: `loading.tsx` is a page-shaped shimmer skeleton that fades in after 150ms; `error.tsx`, `PermissionDenied` and `StaffSetupProblem` share the centred empty-state anatomy; `DbErrorNotice` is a warning `AdminNotice` (its pulsing icon is gone); `SessionWarning` is a toast bottom-left of the content area so it never stacks on the bottom-right save toasts.

### 4. Motion inventory

All `admin-` prefixed in `globals.css`, opacity/translate/scale only (no layout shift), `backwards` fill so finished animations leave no transform behind (a lingering transform would capture fixed-position toasts).

| What | How | Timing |
|---|---|---|
| Page content on route entry | `.admin-page-enter` on `AdminPage` (fade + 6px rise) | 260ms |
| Title accent rule | `.admin-rule` draws in (`scale-x`) | 420ms, 120ms delay |
| Rows, cards, list items | `.admin-stagger > :not([data-entered])` cascade, first mount only | 280ms, 30ms steps capped at 210ms |
| Notices, inline forms, panels, field errors | `.admin-fade-in` | 200ms |
| Loading skeleton | `.admin-skeleton-enter` (150ms delay) + `.admin-skeleton` shimmer | 200ms / 1.6s loop |
| Modals (detail, confirm delete) | `.admin-modal-overlay` / `.admin-modal` on RAC `data-entering` / `data-exiting`; RAC holds the exit until it finishes | 200–240ms in, 150ms out |
| Popovers (staff menus) | `.admin-popover` on `data-entering` / `data-exiting` | 180ms in, 120ms out |
| Toasts | `.admin-toast` slide-up | 240ms |
| Tabs / segmented | RAC `SelectionIndicator` glide | 250ms |
| Sidebar active marker | inset accent bar `scale-y` | 300ms |
| Content history, sidebar categories | RAC Disclosure height via `--disclosure-panel-height` | 300ms |
| Buttons, chips, row icons | press scale 0.97 / 0.95 / 0.94 | 150ms |
| Stat cards, tiles, gallery cards | hover lift 2px + accent ring; gallery image zoom 1.03 | 200ms / 500ms |

**Stagger is first-mount only.** Browsers restart a CSS animation when a node is moved, and React moves keyed children with `insertBefore` on reorder, so with `backwards` fill a reordered gallery card or role row blinked to opacity 0 and replayed. `AdminShell` (persistent across admin routes) listens for `animationend` of `admin-rise` and marks the child `data-entered`; on mount it also settles children that finished before hydration. Moved nodes keep the attribute and never replay; newly inserted rows still animate. Verified: reordering gallery cards keeps every card at opacity 1.

Reduced motion: the existing global rule collapses durations, and an explicit block sets `animation: none !important` on every `admin-*` animation class, because stagger and skeleton delays would otherwise still hold content invisible. Transitions add `motion-reduce:transition-none` / `motion-reduce:*:scale-100|translate-y-0` where they move things. No animation library was added; the existing Framer Motion use in the gallery reorder is unchanged.

### 5. Accent (brand pink) rules

Pink marks emphasis and state, roughly one or two touches per region, dark surfaces only:

- **Where it is used:** page eyebrow dot/text and the title rule; section-title dots; primary buttons (`bg-accent text-on-accent`); active tab underline, active filter/segmented pill (`bg-accent/20 text-accent`); sidebar active bar, active-category dot and accent icon (spec-012); focus rings (`ring-accent/60`); text links and "View" actions; empty-state and stat-card icon tiles (`bg-accent/15 text-accent`); table-row hover edge and clickable-card hover ring (`ring-accent/30`); `pending` application status and accent counts ("6 active terms", "N blocks").
- **Where it is not:** large fills, body text, table headers, borders on resting surfaces, success/warning/danger meaning (those keep their semantic tokens).

### 6. Match Fixtures width budget

Match Fixtures sits in the 2/3 column beside the schedule form, so it must fit about 625px at 1280 (the 24 Sep fit work). It uses the compact cells, 32px (`w-8`) score inputs, team names truncated at `w-16` (`2xl:w-28`), a short Eastern date ("Wed, Sep 23, 2026") over the time, and a text-only "Saving…". Measured in the real two-column layout (table `scrollWidth` vs its column): 1280: 627 / 627, 1366: 684 / 684, 1440: 733 / 733, so no horizontal scroll; min-content width is 606px. Save and Delete stay inside the column.

### 7. Rebase onto main (careers, demographics, school managers)

The branch was rebased onto `350cd57`, which added the careers admin, the student demographics vault, the school-manager modal, and the career-posting filter on Applications. Main's behaviour was kept as is; the presentation layer was reapplied on top:

- **Navigation ([spec-012](spec-012-admin-control-panel-nav.md)):** `/admin/careers` (Careers) joins People & Staffing after Applications, and `/admin/demographics` (Student Demographics) joins League Operations after Schools. The sidebar, breadcrumb and Overview hub pick them up from `admin-nav.ts`.
- **Careers:** `CareersManagerClient` renders the page header (its "New opening" action opens the client modal), a flush section with a status segmented filter and `AdminSearchField`, table tokens, and empty state. `CareerPostingRow` uses status chips, a secondary-button applicant count link and the delete icon with its existing inline confirm. `CareerPostingModal` stays a non-RAC dialog (no behaviour change) with the admin modal look, `admin-modal-pop` entry, associated labels and `AdminNotice` errors.
- **Demographics:** `DemographicsExplorer` uses the page anatomy (restricted/FERPA chips in header meta, Export CSV as header action), KPI tiles, a sticky filter toolbar, table tokens, and the survey modal with `admin-modal` motion.
- **Schools:** main removed the Display order column and field (now a hidden input) and added a "Manage portal managers" row action, styled as an `editIconBtn`. `SchoolManagersModal` uses `AdminTabs` and `AdminNotice`; its three tabs use the label, button, chip, search and contrast tokens.
- **Applications:** main's `?posting=` career filter shows as an info `AdminNotice` with a "Clear filter" action above the staff table.
- **Roles:** main's superadmin-only "View Student Demographics" permission keeps its lock logic and shows a `danger` chip.

## Invariants & Boundaries

- **Presentation only.** No server action, query, permission check, validation rule, route, form field `name`, or database code changed. `id`/`htmlFor`/ARIA attributes were added for label association and roles. Visible text changed to sentence case in places (tests updated for "School applications" / "Staff applications").
- **Public site untouched.** No file under `app/components/ui`, `app/components/layout` or `app/(marketing)` changed. Admin components stopped using the public `Card`, `Button`, `form.tsx` `Field` and the overlay `animate-fade-in`; admin motion is opt-in by class, and `overlay.tsx` itself is unchanged. The only global CSS additions are the `--admin-panel` variable, its `@theme` colour, and `admin-` classes.
- **Kept from spec-012:** categories, Disclosure animation, guide rail, breadcrumb trail, Overview hub (stat cards above it), pinned footer, sidebar scroll.
- **Kept deliberately:** Team role editor's Display/Permissions toggle still conditionally renders each panel's fields (see open-threads: saving from one tab drops the other tab's fields). `ConfirmDeleteButton` still calls `window.confirm` after its dialog. Gallery reorder still uses Framer Motion layout.
- **Compact-density exception** (extends spec-012): filter pills and segmented controls are 28–32px, row actions 32px with a ~42px hit area; the portal is desktop-only.
- **Main is not a scroll container.** `<main>` lost `overflow-y-auto` so the top bar (`sticky top-0`, 56px) and page toolbars (`sticky top-14`) work; the document scrolls (as spec-012 already described).

## Verification

- `npx tsc --noEmit`: clean. `npm run lint`: 0 errors (2 pre-existing warnings outside admin). `npm run build`: passes.
- `npm run test`: 883 passed, 6 skipped, 1 failed: the pre-existing Windows-only `db/__tests__/backup.test.ts` path-separator failure. New tests: `app/components/admin/__tests__/AdminTabs.test.tsx` (`AdminSegmented` selected state; the Leadership form beside it contains no radio; `AdminTabs` selected tab and single mounted panel) and `TeamManagerClient.test.tsx` (initial tabs selected; invites and roles panels, including the role editor's `name`/`perm_*` fields, stay unmounted).
- Visual: the real pages (including the Match Fixtures layout at 1280/1366/1440 for the width budget) were rendered with mocked data through a throwaway vitest `renderToStaticMarkup` harness plus Tailwind compiled from `app/globals.css`, and screenshotted with Playwright (Chrome) at 1440×900 (full page) and 1366×768, with mid-animation frames and a reduced-motion frame. Interactive motion (tab and segmented glide, row hover edge, focus ring, confirm modal enter/exit, toast, gallery reorder without stagger replay) was checked on a temporary non-admin route against the worktree's dev server. Harness and route were deleted afterwards; screenshots are in the gitignored `_scratch/ui-overhaul/shots/`.

## Applications tabs

`/admin/applications` shows one list at a time behind `ApplicationsTabs` (RAC tabs, the same gliding underline as Roles & Staff), with the School and Staff counts on the tabs. The server page still fetches both lists and renders both sections, and RAC mounts only the selected panel. The selected tab is mirrored to `?tab=school|staff` with `history.replaceState` (no refetch); each panel's status-filter links carry their own `tab` value, and a `?posting=` or `?staffStatus=` deep link with no `tab` opens the staff tab. Export, filters and row actions are unchanged.

Both application tables are sized to fit the content column with no horizontal scroll: six columns using the compact cell styles (Applicant with role/email stacked under the name, School or Role, Details, Status, Submitted, Actions), Details chips wrap instead of forcing width, the four status buttons are stacked vertically at equal width (a narrow column, and clearer than a wrapping row), and the old `min-w-[240px]` Details column is gone. Measured with worst-case data (long names, emails, three games, LinkedIn plus motivation): `scrollWidth` equals `clientWidth` at 1280, 1366 and 1440 viewports (content columns 960, 1046 and 1120px).

The first-mount cascade's catch-up pass (marking rows that finished animating before the shell's listener attached) runs 700ms after mount, not immediately. Marking rows while React is still hydrating the page logs a "tree hydrated but some attributes didn't match" warning for every row (`data-entered` appears only on the client).

