# Style tokens reference

Single source of truth for this site's visual language. Pulled from
`app/globals.css` and `app/lib/constants.ts` — re-check those files directly
if a value here looks stale, since this reference is a snapshot.

## Surface, text, and line tokens

| Token | Dark (default) | Light (`.theme-light`) |
|---|---|---|
| `--surface` | `#111111` — midnight graphite | `#ffffff` |
| `--surface-raised` | `#1c1c1c` | `#fdf5f5` |
| `--surface-sunken` | `#0a0a0c` | `#f7eded` |
| `--foreground` | `#f8fafc` | `#2d0015` |
| `--foreground-secondary` | `#b8b8c0` | `#4a2e3b` |
| `--foreground-muted` | `#71717a` | `#6b5560` |
| `--line` | `#27272a` | `#f4cccc` (brand pink demoted to a border on light) |

## Accent and semantic tokens

| Token | Dark | Light |
|---|---|---|
| `--accent` | `#f4cccc` — EZ pink, dark surfaces only | `#b5005a` — deep magenta, the accessible swap for light surfaces |
| `--accent-secondary` | `#4f46e5` | `#4f46e5` (same both themes) |
| `--on-accent` | `#1c1c1c` | `#ffffff` |
| `--success` | `#34d399` | `#047857` |
| `--warning` | `#fbbf24` | `#b45309` |
| `--danger` | `#ef4444` | `#dc2626` |

Use `--accent` (`#f4cccc`) as text or a foreground element only on dark
surfaces — it fails contrast on light backgrounds. On light surfaces, use
`--accent` too, but rely on the token rather than the literal hex: the
`.theme-light` override already swaps it to `#b5005a` for you. Hardcoding
`#f4cccc` as text color on a light section is the single most common contrast
bug in this codebase (see `uiux` skill, case study 1).

Theme switching is scoped via the `.theme-light` class on a subtree (forms,
light-mode sections), not a page-level toggle — apply it to the container
that needs the light variant, and every token underneath follows.

## Hero overlay gradients

- `--hero-overlay-from`: `rgba(10, 10, 10, 0.45)` — darker at the top, for
  nav-over-image contrast.
- `--hero-overlay-via`: `rgba(10, 10, 10, 0.15)` — lighter mid-image so the
  photo stays vibrant.

## Per-game accent colors (`GAMES` in `app/lib/constants.ts`)

| Game | Accent | Text-on-accent |
|---|---|---|
| Valorant | `#FF4655` | `#FFFFFF` |
| League of Legends | `#C8AA6E` | `#1C1508` |
| Teamfight Tactics | `#9D7FE0` | `#1A1330` |

Reference `GAMES[slug].accent` in code rather than copying these hex values —
this table is for design/artifact reference only.

## Typography

- `--font-sans` → Geist Sans (`--font-geist-sans`)
- `--font-mono` → Geist Mono (`--font-geist-mono`)

## Interactive-state styling (React Aria Components)

Two conventions coexist by component type — match whichever the component
you're touching already uses, keeping a single convention per element:

- **RAC data attributes**: `data-[focused]` / `data-[disabled]` selectors,
  for components that expose RAC render-prop state directly (e.g.
  `SeasonSelect.tsx`, `StaffRow.tsx`).
- **Group pseudo-classes**: `group-hover:` / `group-focus-visible:` on a
  `group`-marked wrapper, used for hover and focus-visible rings (e.g.
  `CutCTA.tsx`).

## Container and motion conventions

- `.glass-panel` — the reusable glassmorphic card/panel class (blur,
  gradient background, border). Use it for premium containers instead of
  hand-rolling a new blurred card style.
- Respect `prefers-reduced-motion: reduce` on any transition or animation —
  the codebase convention is to collapse duration to `0.01ms` under that
  media query rather than skip the transition property entirely.
