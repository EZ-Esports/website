import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/lib/onboarding/portal-actions', () => ({
  reviewPlayerInvite: vi.fn(),
  getRosterEligibility: vi.fn(),
  emergencySwapSub: vi.fn(),
  enrollPlayerToRoster: vi.fn(),
  removePlayerFromRoster: vi.fn(),
  movePlayerToRoster: vi.fn(),
  updateRosterPlayerRole: vi.fn(),
  createSchoolRoster: vi.fn(),
  deleteSchoolRoster: vi.fn(),
  createPlayerInvite: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/tour-actions', () => ({ completePortalTour: vi.fn() }));

import SchoolPortalClient from '../../SchoolPortalClient';
import { CLOSING_STEP, TOUR_ANCHORS, TOUR_SECTIONS } from '../steps';

/**
 * Renders the portal as a brand-new school sees it (no submissions, rosters or
 * invites) so the anchors checked are the ones that must exist for every manager.
 */
function renderEmptyPortal(isStaffAdmin = false): string {
  return renderToStaticMarkup(
    <SchoolPortalClient
      context={{ userId: 'u1', email: 'coach@example.edu', isStaffAdmin, managedSchools: [] }}
      activeSchool={{
        schoolId: 's1',
        schoolName: 'Test High',
        schoolSlug: 'test-high',
        managedGames: null,
        isPrimaryContact: false,
        affiliations: [],
      }}
      games={[{ id: 'g1', slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' }]}
      initialInvites={[]}
      initialSubmissions={[]}
      initialRosters={[]}
      matches={[]}
      matchesNowIso="2026-10-24T12:00:00.000Z"
      managedSeasons={[]}
      tourCompleted
    />,
  );
}

// Managers cannot create rosters, so the create-roster anchor is staff only. The tour skips a
// step whose anchor is absent (resolveTourSteps), so the manager tour simply omits that step.
const STAFF_ONLY_ANCHORS = new Set<string>(['create-roster']);

describe('tour anchors', () => {
  const html = renderEmptyPortal();
  const staffHtml = renderEmptyPortal(true);

  for (const anchor of TOUR_ANCHORS.filter((a) => !STAFF_ONLY_ANCHORS.has(a))) {
    it(`renders data-tour="${anchor}" in the portal`, () => {
      expect(html).toContain(`data-tour="${anchor}"`);
    });
  }

  it('renders every anchor a manager tour step refers to exactly once', () => {
    for (const step of [...TOUR_SECTIONS.flatMap((s) => s.steps), CLOSING_STEP]) {
      if (STAFF_ONLY_ANCHORS.has(step.anchor)) continue;
      const matches = html.split(`data-tour="${step.anchor}"`).length - 1;
      expect(matches, `anchor ${step.anchor} for step ${step.id}`).toBe(1);
    }
  });

  it('omits the create-roster anchor for managers', () => {
    expect(html).not.toContain('data-tour="create-roster"');
    expect(html).not.toContain('Create First Roster');
  });

  it('renders the create-roster anchor exactly once for staff', () => {
    expect(staffHtml.split('data-tour="create-roster"').length - 1).toBe(1);
    expect(staffHtml).toContain('Create First Roster');
  });

  it('renders the Tutorial button', () => {
    expect(html).toContain('Tutorial');
  });
});
