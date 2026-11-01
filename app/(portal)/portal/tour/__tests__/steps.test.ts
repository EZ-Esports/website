import { describe, it, expect } from 'vitest';
import { TRACKER_LINK_STEPS } from '@/app/lib/match-results/tracker-link-help';
import { CLOSING_STEP, TOUR_ANCHORS, TOUR_SECTIONS, resolveTourSteps } from '../steps';

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
    expect(TOUR_ANCHORS).toContain(CLOSING_STEP.anchor);
  });
});

describe('tour coverage', () => {
  it('uses every declared anchor in at least one step', () => {
    const used = new Set([...TOUR_SECTIONS.flatMap((s) => s.steps), CLOSING_STEP].map((step) => step.anchor));
    for (const anchor of TOUR_ANCHORS) expect(used, `unused anchor ${anchor}`).toContain(anchor);
  });

  it('teaches how to get a tracker.gg match link, using the same steps as the dialog help', () => {
    const step = TOUR_SECTIONS.flatMap((s) => s.steps).find((st) => st.id === 'result-get-link');
    expect(step).toBeDefined();
    for (const line of TRACKER_LINK_STEPS) expect(step!.body).toContain(line);
  });

  it('covers match results, rosters, invites, approvals and reschedules', () => {
    const ids = TOUR_SECTIONS.flatMap((s) => s.steps.map((st) => st.id));
    for (const id of ['result-submit', 'result-rules', 'result-scoreboard', 'enroll-players', 'eligibility', 'invite-history', 'approvals', 'reschedule', 'match-tabs']) {
      expect(ids).toContain(id);
    }
  });
});

describe('resolveTourSteps', () => {
  it('returns every step in definition order for the full tour', () => {
    const steps = resolveTourSteps('full', everything);
    expect(steps.map((s) => s.id)).toEqual([
      ...TOUR_SECTIONS.flatMap((section) => section.steps.map((s) => s.id)),
      CLOSING_STEP.id,
    ]);
  });

  it('ends the full tour on the Tutorial-button step and never adds it to a section replay', () => {
    const full = resolveTourSteps('full', everything);
    expect(full[full.length - 1].anchor).toBe('tutorial-button');
    for (const section of TOUR_SECTIONS) {
      const steps = resolveTourSteps(section.id, everything);
      expect(steps.some((s) => s.id === CLOSING_STEP.id)).toBe(false);
    }
    expect(TOUR_SECTIONS.flatMap((s) => s.steps).some((s) => s.id === CLOSING_STEP.id)).toBe(false);
  });

  it('omits the closing step when the Tutorial button is not rendered', () => {
    const steps = resolveTourSteps('full', (anchor) => anchor !== 'tutorial-button');
    expect(steps.some((s) => s.id === CLOSING_STEP.id)).toBe(false);
    expect(steps.length).toBeGreaterThan(0);
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
