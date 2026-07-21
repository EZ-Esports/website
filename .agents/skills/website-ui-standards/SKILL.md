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
*   **Navigation Links**: Prefer RAC's `Link` (imported as `AriaLink` in headers/layouts to avoid naming conflicts with Next.js) over standard Next.js `<Link>` or HTML `<a>` tags.
*   **Interactive Controls**: Trigger elements like menus or selects must use RAC `MenuTrigger`, `Select`, `ListBox`, and `ListBoxItem` (as seen in [app/components/ui/SeasonSelect.tsx](file:///Users/shangminchen/website/app/components/ui/SeasonSelect.tsx)).
*   **Modals & Popovers**: Overlays must use the thin styled wrappers from [app/components/ui/overlay.tsx](file:///Users/shangminchen/website/app/components/ui/overlay.tsx) (`Overlay`, `Modal`, `Dialog`, `Heading`) which inherit RAC focus containment, Escape-to-close, outside press dismissal, and scroll locking.
*   **Forms & Input Validation**: Use the wrappers in [app/components/ui/form.tsx](file:///Users/shangminchen/website/app/components/ui/form.tsx). `Field` leverages RAC's `TextField` and `FieldError` context to automatically wire up `aria-invalid` and `aria-describedby` when `error` is present.
*   **Exceptions**:
    *   **URL-based Tabs**: Use standard Next.js `Link` with `aria-current="page"` (as in [app/components/ui/FilterTabs.tsx](file:///Users/shangminchen/website/app/components/ui/FilterTabs.tsx)) when selecting tabs changes the browser URL. RAC `Tabs` is reserved for in-page panel switching.
    *   **Native Select**: Use a styled native `<select>` when browser-default behavior is expected and rich dropdown content is unnecessary.

---

## 3. Best Practices for Interactive States

*   **State Selectors**: Use Tailwind's data attribute selectors (e.g. `data-[focused]`, `data-[selected]`, `data-[hovered]`, `group-data-[focus-visible=true]`) to style RAC components since they apply custom states via attributes.
*   **Input Handling**: Use `onPress` instead of `onClick` on RAC `Button`, `Link`, or custom interactive elements to ensure unified keyboard and touch trigger behavior.
