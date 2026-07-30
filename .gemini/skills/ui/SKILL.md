---
name: ui
description: Implementation standards for styling, Tailwind CSS v4, and React Aria Components on this site. Load before implementing or modifying any interface element, component, layout, form, button, dialog, or overlay — or before building a design artifact that should look like it belongs on this site.
---

# UI implementation standards

This skill documents which primitive to reach for and how to style it, so
implementation matches the rest of the codebase on the first pass. For
design *judgment* (page structure, hierarchy, when a section earns its
screen space), load the `uiux` skill instead — this one is about *which
component and which class*, not layout strategy. For the actual color/type
values, see `references/style-tokens.md`.

## Styling architecture (Tailwind CSS v4)

Theme tokens live in `app/globals.css` under `:root`, mapped into Tailwind
via `@theme inline`. Use the token classes (`bg-surface`, `text-foreground`,
`border-line`, etc.) rather than literal hex values, so a component
automatically follows theme changes. Apply the `.theme-light` class to a
subtree (a form section, a light-mode panel) to scope the light-theme token
overrides to just that container. Use the `.glass-panel` class for
glassmorphic card/panel containers instead of hand-rolling blur/gradient/
border styles. Wrap animations and transitions in a
`@media (prefers-reduced-motion: reduce)` rule that collapses duration to
`0.01ms`.

## React Aria Components (RAC)

This site's accessibility is backed by React Aria Components and hooks, with
Next.js router integration wired globally through `RouterProvider` in
`app/components/ui/Providers.tsx` — RAC `Link`/`MenuItem` `href`s are
automatically routed client-side through that provider.

Reach for these existing wrappers rather than building new ones:

- **Brand CTA buttons**: `app/components/ui/CutCTA.tsx` — wraps RAC `Link`,
  handles diagonal corner clipping and inset focus rings.
- **Navigation links**: RAC `Link` (commonly imported as `AriaLink` to avoid
  colliding with Next.js `Link`, see `app/components/layout/Header.tsx`).
- **Value-picker dropdowns** (e.g. a season switcher): RAC `Select` +
  `SelectValue` + `ListBox` + `ListBoxItem`, as in
  `app/components/ui/SeasonSelect.tsx`.
- **Action/navigation menus** (e.g. a header dropdown): RAC `MenuTrigger` +
  `Menu` + `MenuItem`, as in `app/components/layout/Navigation.tsx`. Keep
  this composition separate from `Select` — treat `Select` and `Menu` as two
  distinct component families rather than interchangeable.
- **Modals and popovers**: the thin wrappers in `app/components/ui/overlay.tsx`
  (`Overlay`, `Modal`, `Dialog`, `Heading`) — they carry RAC focus
  containment, Escape-to-close, outside-press dismissal, and scroll locking.
- **Forms and validation**: the wrappers in `app/components/ui/form.tsx` —
  `Field` wires up `aria-invalid`/`aria-describedby` automatically from RAC's
  `TextField` and `FieldError` context when an `error` prop is present.

Two exceptions where a non-RAC primitive is the right call:

- **URL-driven tabs**: use plain Next.js `Link` with `aria-current="page"`
  (see `app/components/ui/FilterTabs.tsx`) when selecting a tab changes the
  URL. Reserve RAC `Tabs` for in-page panel switching that doesn't change
  the route.
- **Simple native selects**: a styled native `<select>` is the right choice
  when default browser behavior is exactly what's wanted and the dropdown
  content doesn't need rich rendering.

## Interactive-state styling

Match whichever convention the component already uses:

- RAC data attributes (`data-[focused]`, `data-[disabled]`) for components
  that expose RAC render-prop state directly — see `SeasonSelect.tsx`,
  `app/components/admin/StaffRow.tsx`.
- `group-hover:` / `group-focus-visible:` on a `group`-marked wrapper for
  hover and focus-visible rings — see `CutCTA.tsx`.

Use `onPress` (not `onClick`) on RAC `Button`/`Link` and on components that
wrap RAC primitives, so keyboard and touch trigger the same behavior. Plain
native elements like `app/components/ui/Button.tsx` and most admin
components are built on `onClick` directly — keep those as `onClick`, RAC's
`onPress` is specifically for RAC-backed elements.

Give every interactive control a real tap target: `min-h-[44px]`, as applied
across `SeasonSelect.tsx`, `FilterTabs.tsx`, `Header.tsx`,
`GameSubHeader.tsx`, and `Navigation.tsx`.

For a control that can become inert (a boundary button, a disabled submit),
prefer `aria-disabled` plus a no-op handler over the native `disabled`
attribute when the control needs to stay keyboard-reachable — native
`disabled` removes the element from the tab order entirely, which drops
focus to `document.body` when a keyboard user is mid-navigation through a
list (see the fix in `app/components/admin/GalleryManagerClient.tsx`'s
move-order buttons).

## Color contrast

Use the token classes so contrast is correct by construction — `--accent`
(`#f4cccc`) is styled for dark surfaces and the `.theme-light` override
already swaps in the accessible `#b5005a` for light ones. Full palette in
`references/style-tokens.md`.
