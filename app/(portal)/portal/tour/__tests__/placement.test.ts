import { describe, it, expect } from 'vitest';
import {
  PANEL_MARGIN,
  computePanelPlacement,
  computeScrollDelta,
} from '../placement';

const header = 72;

function fits(
  p: { top: number; left: number },
  panel: { width: number; height: number },
  vp: { width: number; height: number },
) {
  expect(p.top).toBeGreaterThanOrEqual(header);
  expect(p.left).toBeGreaterThanOrEqual(PANEL_MARGIN);
  expect(p.top + panel.height).toBeLessThanOrEqual(vp.height);
  expect(p.left + panel.width).toBeLessThanOrEqual(vp.width);
}

describe('computePanelPlacement', () => {
  const desktop = { width: 1920, height: 1080 };
  const panel = { width: 384, height: 260 };

  it('places the card below a small target', () => {
    const target = { top: 200, left: 100, width: 600, height: 300 };
    const p = computePanelPlacement({ target, panel, viewport: desktop, topInset: header });
    expect(p.mode).toBe('below');
    fits(p, panel, desktop);
  });

  it('docks the card when the target is taller than the viewport', () => {
    const target = { top: 88, left: 100, width: 1700, height: 1800 };
    const p = computePanelPlacement({ target, panel, viewport: desktop, topInset: header });
    expect(p.mode).toBe('docked');
    fits(p, panel, desktop);
  });

  it('flips above when there is no room below', () => {
    const target = { top: 760, left: 100, width: 400, height: 260 };
    const p = computePanelPlacement({ target, panel, viewport: desktop, topInset: header });
    expect(p.mode).toBe('above');
    fits(p, panel, desktop);
  });

  it('uses a bottom sheet on phones', () => {
    const vp = { width: 375, height: 812 };
    const small = { width: 351, height: 300 };
    const target = { top: 120, left: 12, width: 351, height: 400 };
    const p = computePanelPlacement({ target, panel: small, viewport: vp, topInset: header });
    expect(p.mode).toBe('docked');
    expect(p.top + small.height).toBeLessThanOrEqual(vp.height - PANEL_MARGIN);
    fits(p, small, vp);
  });
});

describe('computeScrollDelta', () => {
  const panel = { width: 384, height: 260 };

  it('does not scroll when target and card already fit', () => {
    const target = { top: 200, left: 0, width: 600, height: 300 };
    expect(
      computeScrollDelta({
        target,
        panel,
        viewport: { width: 1920, height: 1080 },
        topInset: header,
      }),
    ).toBe(0);
  });

  it('pins the top of a target that cannot fit with the card', () => {
    const target = { top: 900, left: 0, width: 1700, height: 1800 };
    const delta = computeScrollDelta({
      target,
      panel,
      viewport: { width: 1920, height: 1080 },
      topInset: header,
    });
    expect(900 - delta).toBe(header + 16);
  });

  it('leaves room above a phone bottom sheet', () => {
    const vp = { width: 375, height: 812 };
    const sheet = { width: 351, height: 320 };
    const target = { top: 700, left: 12, width: 351, height: 200 };
    const delta = computeScrollDelta({ target, panel: sheet, viewport: vp, topInset: header });
    const newBottom = 700 - delta + 200;
    expect(newBottom).toBeLessThanOrEqual(vp.height - sheet.height - PANEL_MARGIN);
  });
});
