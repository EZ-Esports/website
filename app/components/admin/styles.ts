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
 * Row actions: edit (pen icon), save (text), cancel (text; an X icon only for
 * the Gallery card's edit/cancel toggle) and delete (trash icon). They share
 * one 32px height so they line up in any row. Icon-only buttons need an
 * `aria-label` and a `title` (`RowIconButton` and `ConfirmDeleteButton` do).
 *
 * Icon buttons are 32px squares whose hit area is padded out to ~42px by an
 * invisible `after:-inset-1.5` pseudo-element (the inset is measured inside
 * the 1px border), so they stay compact in dense admin tables. The overhang
 * spills 6px past the button on every side, so its container needs at least
 * 6px of padding/gap on each side: keep >= `gap-2` between buttons and give a
 * bare `text-right` cell inside `overflow-x-auto` a `pr-2`, or it adds a
 * scrollbar. Text buttons (`saveBtn`, `cancelBtn`) have no overhang.
 */
const rowBtnBase =
  'inline-flex items-center justify-center rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';

const rowIconGeometry = `${rowBtnBase} relative h-8 w-8 shrink-0 after:absolute after:-inset-1.5 after:content-['']`;

const rowTextGeometry = `${rowBtnBase} h-8 shrink-0 px-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap`;

/**
 * The "white glow" look, lifted from the Leadership Manager's Edit button:
 * soft-white `text-foreground` on the raised surface, stepping up to the line
 * colour on hover (there is no literal box-shadow). Shared by the pen Edit icon
 * and the text Save button so they read as the primary actions.
 */
const whiteGlow =
  'bg-surface-raised hover:bg-line border-line text-foreground focus-visible:ring-accent/60';

export const editIconBtn = `${rowIconGeometry} ${whiteGlow}`;

export const saveBtn = `${rowTextGeometry} ${whiteGlow}`;

/** Same shape as edit/save, one step quieter: the secondary "close without saving" action. */
const quiet =
  'bg-surface-raised hover:bg-line border-line text-foreground-secondary hover:text-foreground focus-visible:ring-accent/60';

export const cancelIconBtn = `${rowIconGeometry} ${quiet}`;

export const cancelBtn = `${rowTextGeometry} ${quiet}`;

/**
 * Every trash button shares one faint-red look (`deleteIconColors`), the same
 * one the Applications tab uses.
 */
const deleteIconColors =
  'bg-red-950/10 border-red-900/30 text-red-400 hover:bg-red-950/30 hover:border-red-900/60';

export const deleteIconBtn = `${rowIconGeometry} focus-visible:ring-red-400/60 ${deleteIconColors}`;

/**
 * The delete colours at a small size, for the one place the 32px box does not
 * fit: the corner trash on a roster/team tile. No overhang and no padding: add
 * `p-1` and position it at the call site.
 */
export const deleteIconBtnCompact = `inline-flex items-center justify-center rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${deleteIconColors}`;

export const selectClass =
  'px-3 py-1.5 bg-surface-sunken border border-line rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer';
