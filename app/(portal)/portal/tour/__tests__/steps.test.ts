import { describe, it, expect } from 'vitest';
import { TOUR_ANCHORS, TOUR_SECTIONS, resolveTourSteps } from '../steps';

const everything = () => true;

describe('tour definition', () => {
  it('has unique section ids and unique step ids', () => {
    const sectionIds = TOUR_SECTIONS.map((s) => s.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    const stepIds = TOUR_SECTIONS.flatMap((s) => s.steps.map((st) => st.id));
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it('only references declared anchors and every section has steps', () => {
    for (const section of TOUR_SECTIONS) {
      expect(section.steps.length).toBeGreaterThan(0);
      for (const step of section.steps) expect(TOUR_ANCHORS).toContain(step.anchor);
    }
  });
});

describe('resolveTourSteps', () => {
  it('returns every step in definition order for the full tour', () => {
    const steps = resolveTourSteps('full', everything);
    expect(steps.map((s) => s.id)).toEqual(
      TOUR_SECTIONS.flatMap((section) => section.steps.map((s) => s.id)),
    );
  });

  it('slices exactly one section for a section replay, ending at its boundary', () => {
    for (const section of TOUR_SECTIONS) {
      const steps = resolveTourSteps(section.id, everything);
      expect(steps.map((s) => s.id)).toEqual(section.steps.map((s) => s.id));
      expect(new Set(steps.map((s) => s.sectionId))).toEqual(new Set([section.id]));
    }
  });

  it('omits steps whose target is missing', () => {
    const steps = resolveTourSteps('full', (anchor) => anchor !== 'approvals');
    expect(steps.some((s) => s.anchor === 'approvals')).toBe(false);
    expect(steps.length).toBeGreaterThan(0);
  });

  it('returns an empty tour for an unknown section or when nothing is present', () => {
    expect(resolveTourSteps('nope', everything)).toEqual([]);
    expect(resolveTourSteps('full', () => false)).toEqual([]);
  });
});
