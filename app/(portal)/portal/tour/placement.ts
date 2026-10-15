/**
 * Pure geometry for the tour card. Kept free of the DOM so the placement rules can be
 * unit-tested at the viewport sizes that broke before (1920x1080 with a section taller
 * than the screen, and 375x812 phones).
 */

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PlacementInput {
  /** Target rect in viewport coordinates. */
  target: Box;
  panel: Size;
  viewport: Size;
  /** Height of the sticky site header; the card never sits underneath it. */
  topInset: number;
}

export interface PlacementResult {
  top: number;
  left: number;
  mode: 'below' | 'above' | 'docked';
}

export const PANEL_MARGIN = 12;
export const PANEL_GAP = 16;
/** Below this width the card is a bottom sheet rather than a popover beside its target. */
export const MOBILE_BREAKPOINT = 640;

export function isMobileViewport(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Chooses where the card goes. Order of preference: below the target, above it, then
 * docked to the viewport (bottom sheet on phones, bottom-right corner on desktop). The
 * docked fallback is what keeps a target taller than the screen (the Rosters section)
 * from pushing the card off-screen, which no amount of flipping can fix.
 */
export function computePanelPlacement({
  target,
  panel,
  viewport,
  topInset,
}: PlacementInput): PlacementResult {
  const maxLeft = viewport.width - panel.width - PANEL_MARGIN;
  const dockTop = clamp(
    viewport.height - panel.height - PANEL_MARGIN,
    topInset + PANEL_MARGIN,
    viewport.height,
  );

  if (isMobileViewport(viewport.width)) {
    return {
      top: dockTop,
      left: clamp((viewport.width - panel.width) / 2, PANEL_MARGIN, maxLeft),
      mode: 'docked',
    };
  }

  const left = clamp(
    target.left + target.width / 2 - panel.width / 2,
    PANEL_MARGIN,
    maxLeft,
  );
  const targetBottom = target.top + target.height;
  const roomBelow = viewport.height - PANEL_MARGIN - (targetBottom + PANEL_GAP);
  if (roomBelow >= panel.height && targetBottom + PANEL_GAP >= topInset) {
    return { top: targetBottom + PANEL_GAP, left, mode: 'below' };
  }
  const roomAbove = target.top - PANEL_GAP - (topInset + PANEL_MARGIN);
  if (roomAbove >= panel.height && target.top - PANEL_GAP <= viewport.height) {
    return { top: target.top - PANEL_GAP - panel.height, left, mode: 'above' };
  }
  return { top: dockTop, left: Math.max(PANEL_MARGIN, maxLeft - 12), mode: 'docked' };
}

/**
 * How far to scroll the page (positive = down) so the target is visible and, when it
 * fits, so is the card. `reserveBottom` is the space a docked card will cover.
 */
export function computeScrollDelta({
  target,
  panel,
  viewport,
  topInset,
}: PlacementInput): number {
  const top = topInset + PANEL_GAP;
  const mobile = isMobileViewport(viewport.width);
  const reserveBottom = mobile ? panel.height + PANEL_MARGIN * 2 : PANEL_MARGIN + PANEL_GAP;
  const bottom = viewport.height - reserveBottom;
  const available = bottom - top;
  // On desktop the card sits under the target, so both must fit together.
  const needed = target.height + (mobile ? 0 : PANEL_GAP + panel.height);

  if (needed <= available) {
    const targetBottom = target.top + target.height;
    const wantedBottom = mobile ? targetBottom : targetBottom + PANEL_GAP + panel.height;
    if (target.top >= top && wantedBottom <= bottom) return 0;
    return target.top - (top + (available - needed) / 2);
  }
  // Too tall to show with the card: pin its top edge and let the card dock over it.
  return target.top - top;
}
