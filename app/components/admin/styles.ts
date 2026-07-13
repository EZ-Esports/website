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

export const selectClass =
  'px-3 py-1.5 bg-surface-sunken border border-line rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer';
