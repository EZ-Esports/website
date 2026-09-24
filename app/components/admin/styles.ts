/**
 * Shared admin-panel class strings. These were previously copy-pasted per
 * component (RosterExplorer, LeagueSetupClient, ...) and had already started
 * to drift; new admin surfaces should import from here instead.
 *
 * Expressed on semantic tokens (PR3) rather than raw slate/zinc/ez-* utilities.
 * These are bespoke, not built from app/components/ui/form.tsx or Button.tsx:
 * the shared primitives target the larger public-facing surfaces (px-4 py-3
 * inputs, ring-2 focus rings, sentence-case font-semibold buttons), while the
 * admin panel is deliberately denser (px-3 py-2, ring-1) and its buttons are
 * uppercase/tracking-wider/font-bold — reusing buttonClasses() would have
 * dropped the uppercase treatment and the disabled-state styling that admin
 * relies on, which is more than the "subtle token shift" this slice allows.
 */
export const input =
  'w-full px-3 py-2 bg-surface-sunken border border-line rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 transition-all';

export const primaryBtn =
  'px-4 py-2 bg-foreground hover:opacity-90 text-surface text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

export const secondaryBtn =
  'px-3.5 py-2 bg-surface-raised hover:bg-line border border-line text-foreground-secondary text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer';

export const iconBtn =
  'p-1.5 hover:bg-line rounded-lg text-foreground-secondary hover:text-foreground transition-all cursor-pointer';

/**
 * Destructive trash-can icon buttons (delete / remove). Every trash button in
 * the staff area shares one faint-red look (`deleteIconColors`), the same one
 * the Applications tab uses. Always pair with an `aria-label` (icon-only) and a
 * `title`.
 *
 * `deleteIconBtn` is the standard 32px square. Its hit area is padded out to
 * ~42px by an invisible `after:-inset-1.5` pseudo-element (the inset is
 * measured inside the 1px border), so it stays compact in dense admin tables.
 * The overhang spills 6px past the button on every side, so its container needs
 * at least 6px of padding/gap on each side (a bare `text-right` cell inside
 * `overflow-x-auto` needs `pr-2`, or it adds a scrollbar).
 *
 * `deleteIconBtnCompact` is the same colours at a small size for dense,
 * hover-revealed rows (roster, league, tiles). It has no overhang and no
 * padding: add `p-1.5` (or `p-1`) and position it at the call site.
 */
const deleteIconColors =
  'bg-red-950/10 border-red-900/30 text-red-400 hover:bg-red-950/30 hover:border-red-900/60';

const deleteIconFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60';

export const deleteIconBtn = `relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${deleteIconFocus} ${deleteIconColors} after:absolute after:-inset-1.5 after:content-['']`;

export const deleteIconBtnCompact = `inline-flex items-center justify-center rounded-lg border transition-all cursor-pointer ${deleteIconFocus} ${deleteIconColors}`;

export const selectClass =
  'px-3 py-1.5 bg-surface-sunken border border-line rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer';
