---
name: website-ui-standards
description: Project UI standards for styling, Tailwind CSS v4, and React Aria Components usage. Use this skill when implementing or modifying any user interface elements, components, layouts, forms, buttons, or dialogs.
---

# UI & Accessibility Coding Standards

This skill documents the styling architecture and React Aria integration standards for the EZ-Esports website codebase. All agents and developers working on the UI of this repository **MUST** adhere to these practices.

---

## 1. Styling & CSS Architecture (Tailwind CSS v4)

The project leverages **Tailwind CSS v4** (configured via `@import "tailwindcss"` in [app/globals.css](file:///Users/shangminchen/website/app/globals.css)).

### Design System & Custom Properties
*   **Theme Tokens**: Custom design variables are declared in [app/globals.css](file:///Users/shangminchen/website/app/globals.css) under `:root` and mapped inside Tailwind using `@theme inline`.
*   **Colors**:
    *   **Surface**: Midnight graphite (`--surface: #111111`) for the dark theme.
    *   **Accent**: Light pink (`--accent: #f4cccc`) for accents on dark surfaces.
*   **Subtree Theme Swapping**: Scoped light mode (for forms, etc.) is achieved via the `.theme-light` class, which overrides CSS variables for text, background, and accents inline without changing layout classes.
*   **Glassmorphic Container**: Reusable premium card/panel containers should use the `.glass-panel` class, providing blur, gradient backgrounds, and borders.
*   **Accessibility & Motion**: Animations and transitions must respect system preferences using `@media (prefers-reduced-motion: reduce)` which sets duration to `0.01ms`.

---

## 2. React Aria Components (RAC) & Accessibility

Accessibility is backed by **React Aria Components (RAC)** and **React Aria Hooks**.

### Client-Side Navigation
*   **Next.js Router Integration**: Internal navigation inside RAC elements (e.g., RAC `Link` or `MenuItem` with `href`) is automatically intercepted and directed through Next.js client-side navigation. This is wired up globally via the `RouterProvider` in [app/components/ui/Providers.tsx](file:///Users/shangminchen/website/app/components/ui/Providers.tsx).

### Component Guidelines
*   **Action & CTA Buttons**: Use [app/components/ui/CutCTA.tsx](file:///Users/shangminchen/website/app/components/ui/CutCTA.tsx) for brand buttons (e.g. "Apply Now"). It wraps RAC's `Link` and manages diagonal corner clipping along with inset focus rings.
*   **Navigation Links**: Prefer RAC's `Link` (imported as `AriaLink` in [app/components/layout/Header.tsx](file:///Users/shangminchen/website/app/components/layout/Header.tsx) to avoid a naming conflict with Next.js) over standard Next.js `<Link>` or HTML `<a>` tags.
*   **Select-style Dropdowns**: For a value picker backed by a list of options (e.g. a season switcher), use RAC `Select`, `SelectValue`, `ListBox`, and `ListBoxItem` (as seen in [app/components/ui/SeasonSelect.tsx](file:///Users/shangminchen/website/app/components/ui/SeasonSelect.tsx)).
*   **Menu-style Dropdowns**: For an action/navigation menu opened from a trigger button (e.g. the header's nav dropdowns), use RAC `MenuTrigger`, `Menu`, and `MenuItem` (as seen in [app/components/layout/Navigation.tsx](file:///Users/shangminchen/website/app/components/layout/Navigation.tsx)). These are two distinct RAC compositions — don't mix `Select` with `Menu`/`MenuItem` or vice versa.
*   **Modals & Popovers**: Overlays must use the thin styled wrappers from [app/components/ui/overlay.tsx](file:///Users/shangminchen/website/app/components/ui/overlay.tsx) (`Overlay`, `Modal`, `Dialog`, `Heading`) which inherit RAC focus containment, Escape-to-close, outside press dismissal, and scroll locking.
*   **Forms & Input Validation**: Use the wrappers in [app/components/ui/form.tsx](file:///Users/shangminchen/website/app/components/ui/form.tsx). `Field` leverages RAC's `TextField` and `FieldError` context to automatically wire up `aria-invalid` and `aria-describedby` when `error` is present.
*   **Exceptions**:
    *   **URL-based Tabs**: Use standard Next.js `Link` with `aria-current="page"` (as in [app/components/ui/FilterTabs.tsx](file:///Users/shangminchen/website/app/components/ui/FilterTabs.tsx)) when selecting tabs changes the browser URL. RAC `Tabs` is reserved for in-page panel switching.
    *   **Native Select**: Use a styled native `<select>` when browser-default behavior is expected and rich dropdown content is unnecessary.

---

## 3. Best Practices for Interactive States

*   **State Selectors**: Use Tailwind's data attribute selectors — `data-[focused]` and `data-[disabled]` — to style RAC components since they expose these states as DOM attributes (as seen in [app/components/ui/SeasonSelect.tsx](file:///Users/shangminchen/website/app/components/ui/SeasonSelect.tsx) and [app/components/admin/StaffRow.tsx](file:///Users/shangminchen/website/app/components/admin/StaffRow.tsx)). For hover and focus-visible rings, this codebase instead relies on Tailwind's native `group-hover:` / `group-focus-visible:` pseudo-class variants on a `group`-marked wrapper, not RAC data attributes (as seen in [app/components/ui/CutCTA.tsx](file:///Users/shangminchen/website/app/components/ui/CutCTA.tsx)).
*   **Input Handling**: Use `onPress` instead of `onClick` on RAC `Button`/`Link` and on components that wrap RAC primitives (e.g. [app/components/ui/CutCTA.tsx](file:///Users/shangminchen/website/app/components/ui/CutCTA.tsx)) to ensure unified keyboard and touch trigger behavior. This does not apply to the plain native [app/components/ui/Button.tsx](file:///Users/shangminchen/website/app/components/ui/Button.tsx) or other non-RAC elements (most admin components), which are correctly built on `onClick`.
*   **Touch Targets**: Interactive controls use `min-h-[44px]` to guarantee an accessible tap target size, consistently applied across [app/components/ui/SeasonSelect.tsx](file:///Users/shangminchen/website/app/components/ui/SeasonSelect.tsx), [app/components/ui/FilterTabs.tsx](file:///Users/shangminchen/website/app/components/ui/FilterTabs.tsx), [app/components/layout/Header.tsx](file:///Users/shangminchen/website/app/components/layout/Header.tsx), [app/components/layout/GameSubHeader.tsx](file:///Users/shangminchen/website/app/components/layout/GameSubHeader.tsx), and [app/components/layout/Navigation.tsx](file:///Users/shangminchen/website/app/components/layout/Navigation.tsx).
