/**
 * Staff portal design tokens as class strings (spec-013). New admin surfaces
 * import from here (or use the primitives in `AdminUI.tsx`) instead of
 * hand-writing utilities, so pages cannot drift apart again.
 *
 * Expressed on semantic tokens rather than raw slate/zinc utilities. These are
 * bespoke, not built from app/components/ui/form.tsx or Button.tsx: the shared
 * primitives target the larger public-facing surfaces (px-4 py-3 inputs,
 * active:scale-95, 300ms transitions), and changing them would change the
 * public site. The admin is deliberately denser and calmer:
 *
 * - Sentence-case labels and buttons. No uppercase/tracking-wider micro-labels;
 *   the size and weight steps below carry the hierarchy instead.
 * - Type scale: page title `text-2xl font-semibold`, section title
 *   `text-base font-semibold`, label `text-[13px] font-medium`, helper and
 *   meta text `text-xs`/`text-sm` in `foreground-secondary` (muted grey fails
 *   AA on these surfaces for body text, so it is kept for placeholders and
 *   tertiary meta only).
 * - Surfaces: the page is `bg-surface`, a section is one step up
 *   (`bg-admin-panel`), inputs sit one step down (`bg-surface-sunken`).
 *   Spacing and those steps separate things; borders are hairlines
 *   (`border-line/60`) used only for dividers and input outlines.
 * - Motion: 150ms colour/transform transitions, a 0.97 press scale on
 *   buttons, everything `motion-reduce` safe. Page-level motion lives in the
 *   `admin-*` classes in globals.css.
 */

/** One focus treatment for every custom control. Offset matches the page surface. */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/* ---------------------------------------------------------------------------
 * Form fields
 * ------------------------------------------------------------------------- */

const inputBase =
  'block w-full bg-surface-sunken border border-line/70 rounded-lg text-foreground placeholder:text-foreground-muted transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-line focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 disabled:opacity-50 disabled:cursor-not-allowed';

/** Text input, textarea or form `<select>`. Add `pl-9` for a leading icon. */
export const input = `${inputBase} px-3 py-2 text-sm`;

/** The same field one size down (32px), for search boxes in filter toolbars and read-only values. */
export const inputSm = `${inputBase} h-8 px-3 py-1 text-xs`;

/** Native `<select>` in a filter toolbar: same look as `input`, one size smaller. */
export const selectClass =
  'h-8 pl-3 py-1 bg-surface-sunken border border-line/70 rounded-lg text-xs text-foreground cursor-pointer transition-[border-color,box-shadow] duration-150 ease-out hover:border-line focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 disabled:opacity-50 disabled:cursor-not-allowed [--select-chevron-inset:0.75rem] [--select-chevron-space:2.25rem]';

/** Field label text without spacing, for labels laid out by a parent's `space-y-*`. */
export const labelText = 'block text-[13px] font-medium text-foreground-secondary';

/** Field label. Sentence case; required fields add `<RequiredMark />` from AdminUI. */
export const label = `${labelText} mb-1.5`;

/** One line of guidance under a field. */
export const helpText = 'mt-1.5 text-xs leading-5 text-foreground-secondary';

/** Inline error under a field or next to a row control. */
export const fieldError = 'admin-fade-in mt-1.5 text-xs font-medium text-danger-on-tint';

/* ---------------------------------------------------------------------------
 * Buttons
 *
 * One primary (accent) action per region, secondary for the rest, ghost for
 * low-emphasis toggles, danger only inside a confirmation. All share one
 * height per size so they line up in toolbars.
 * ------------------------------------------------------------------------- */

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap select-none cursor-pointer transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed';

const btnSize = {
  md: 'h-9 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
  /** 24px, only for inline confirm prompts inside a row. */
  xs: 'h-6 px-2 text-xs',
} as const;

const btnTone = {
  primary: 'bg-accent text-on-accent hover:bg-accent/85',
  secondary: 'bg-surface-raised text-foreground border border-line/70 hover:bg-line/70 hover:border-line',
  ghost: 'text-foreground-secondary hover:text-foreground hover:bg-surface-raised',
  danger: 'bg-red-600 text-white hover:bg-red-500',
} as const;

export type AdminButtonTone = keyof typeof btnTone;
export type AdminButtonSize = keyof typeof btnSize;

/** Compose an admin button class. Prefer the named exports below for the common cases. */
export function adminButton(tone: AdminButtonTone = 'primary', size: AdminButtonSize = 'md'): string {
  return `${btnBase} ${btnSize[size]} ${btnTone[tone]} ${focusRing}`;
}

export const primaryBtn = adminButton('primary');
export const secondaryBtn = adminButton('secondary');
export const ghostBtn = adminButton('ghost');
export const dangerBtn = adminButton('danger');
export const primaryBtnSm = adminButton('primary', 'sm');
export const secondaryBtnSm = adminButton('secondary', 'sm');
export const ghostBtnSm = adminButton('ghost', 'sm');

const iconBtnBase = `inline-flex shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-raised transition-colors duration-150 cursor-pointer ${focusRing}`;

/** Square icon-only button for toolbars and panel headers (close, back). Needs an aria-label. */
export const iconBtn = `${iconBtnBase} h-8 w-8`;

/** 28px variant for dismiss buttons inside notices and toasts. */
export const iconBtnSm = `${iconBtnBase} h-7 w-7`;

/** Quiet inline text action ("View", "History"). `textLinkSm` is the 12px variant for table cells. */
const textLinkBase = `rounded font-medium text-accent hover:text-accent/80 underline-offset-4 hover:underline transition-colors cursor-pointer ${focusRing}`;
export const textLink = `${textLinkBase} text-sm`;
export const textLinkSm = `${textLinkBase} text-xs`;

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
  'inline-flex items-center justify-center rounded-lg border transition-[background-color,border-color,color,scale] duration-150 ease-out cursor-pointer active:scale-[0.94] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

const rowIconGeometry = `${rowBtnBase} relative h-8 w-8 shrink-0 after:absolute after:-inset-1.5 after:content-['']`;

const rowTextGeometry = `${rowBtnBase} h-8 shrink-0 px-3 text-xs font-semibold whitespace-nowrap`;

/**
 * The "white glow" look, lifted from the Leadership Manager's Edit button:
 * soft-white `text-foreground` on the raised surface, stepping up to the line
 * colour on hover (there is no literal box-shadow). Shared by the pen Edit icon
 * and the text Save button so they read as the primary actions.
 */
const whiteGlow =
  'bg-surface-raised hover:bg-line border-line/70 hover:border-line text-foreground focus-visible:ring-accent/60';

export const editIconBtn = `${rowIconGeometry} ${whiteGlow}`;

export const saveBtn = `${rowTextGeometry} ${whiteGlow}`;

/** Same shape as edit/save, one step quieter: the secondary "close without saving" action. */
const quiet =
  'bg-transparent hover:bg-surface-raised border-transparent text-foreground-secondary hover:text-foreground focus-visible:ring-accent/60';

export const cancelIconBtn = `${rowIconGeometry} ${quiet}`;

export const cancelBtn = `${rowTextGeometry} ${quiet}`;

/**
 * Every trash button shares one faint-red look (`deleteIconColors`), the same
 * one the Applications tab uses.
 */
const deleteIconColors =
  'bg-red-950/10 border-red-900/30 text-red-400 hover:bg-red-950/40 hover:border-red-900/60 hover:text-red-300';

export const deleteIconBtn = `${rowIconGeometry} focus-visible:ring-red-400/60 ${deleteIconColors}`;

/**
 * The delete colours at a small size, for the one place the 32px box does not
 * fit: the corner trash on a roster/team tile. No overhang and no padding: add
 * `p-1` and position it at the call site.
 */
export const deleteIconBtnCompact = `inline-flex items-center justify-center rounded-lg border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${deleteIconColors}`;

/* ---------------------------------------------------------------------------
 * Chips (status, tier, category). Sentence case, no border, tinted fill.
 * ------------------------------------------------------------------------- */

const chipTone = {
  neutral: 'bg-surface-raised text-foreground-secondary',
  /** No fill: an available-but-not-current option next to a current chip. */
  ghost: 'text-foreground-secondary hover:bg-surface-raised hover:text-foreground',
  accent: 'bg-accent/20 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/15 text-danger-on-tint',
  info: 'bg-sky-400/10 text-sky-300',
  violet: 'bg-violet-400/10 text-violet-300',
} as const;

export type ChipTone = keyof typeof chipTone;

/** Static label chip. Add a dot with `<span className={chipDot} />` as the first child. `sm` is 20px tall. */
export function chip(tone: ChipTone = 'neutral', size: 'md' | 'sm' = 'md'): string {
  return `inline-flex items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap ${size === 'sm' ? 'h-5' : 'h-6'} ${chipTone[tone]}`;
}

/** A chip that is also a button (status toggles). Adds hover, press and focus. */
export function chipButton(tone: ChipTone = 'neutral', size: 'md' | 'sm' = 'md'): string {
  return `${chip(tone, size)} cursor-pointer transition-[filter,scale,opacity] duration-150 hover:brightness-125 active:scale-95 motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;
}

export const chipDot = 'h-1.5 w-1.5 shrink-0 rounded-full bg-current';

/* ---------------------------------------------------------------------------
 * Tables and lists. Rows are separated by hairlines and lit on hover; the
 * header row is plain sentence-case text, not a coloured band.
 * ------------------------------------------------------------------------- */

export const tableWrap = 'overflow-x-auto';
export const table = 'w-full border-collapse text-left text-sm';
export const theadRow = 'border-b border-line/60';
export const th = 'px-4 py-2.5 text-xs font-medium text-foreground-secondary whitespace-nowrap first:pl-5 last:pr-5';
export const thRight = `${th} text-right`;
export const td = 'px-4 py-3 align-middle first:pl-5 last:pr-5';
export const tdRight = `${td} text-right`;

/**
 * Compact cells for a table that must fit a narrow column (Match Fixtures sits
 * in the 2/3 column next to the schedule form: ~625px at 1280). The trailing
 * `pr-3` still leaves room for the row-action hit-area overhang.
 */
export const thCompact = 'px-2 py-2.5 text-xs font-medium text-foreground-secondary whitespace-nowrap first:pl-4 last:pr-3';
export const thCompactRight = `${thCompact} text-right`;
export const tdCompact = 'px-2 py-3 align-middle first:pl-4 last:pr-3';
export const tdCompactRight = `${tdCompact} text-right`;
export const tbody = 'admin-stagger divide-y divide-line/50';
/** Hover lights the row and draws a thin accent edge on its first cell. */
export const tr = 'transition-colors duration-150 hover:bg-surface-raised/50 [&>td:first-child]:shadow-[inset_2px_0_0_transparent] hover:[&>td:first-child]:shadow-[inset_2px_0_0_var(--color-accent)] [&>td:first-child]:transition-shadow';
/** A row swapped into an inline edit form. */
export const trEditing = 'bg-surface-raised/40';

/** A stacked list (cards in a column) with the same hairline rhythm as a table. */
export const listStack = 'admin-stagger divide-y divide-line/50';

/** Hover treatment for a clickable card: faint lift plus an accent edge. */
export const cardHover =
  'ring-1 ring-transparent transition-[background-color,translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-surface-raised hover:ring-accent/30 motion-reduce:hover:translate-y-0';

/* ---------------------------------------------------------------------------
 * Segmented filter tabs (URL-driven Links or local buttons). The active tab
 * lifts to the raised surface. Compact-density exception (spec-012/013): the
 * admin is desktop-only, so these are 32px rather than 44px.
 * ------------------------------------------------------------------------- */

export const segmentedGroup = 'inline-flex items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5';

export function segmentedItem(active: boolean): string {
  return `inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-[background-color,color] duration-200 ease-out ${focusRing} ${
    active
      ? 'bg-accent/20 text-accent'
      : 'text-foreground-secondary hover:text-foreground hover:bg-surface-raised/60'
  }`;
}
