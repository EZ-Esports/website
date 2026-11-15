import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const captured = vi.hoisted(() => ({ seasons: [] as Array<Array<{ id: string; gameId: string }>> }));

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
vi.mock('../components/MatchesSection', () => ({
  MatchesSection: (props: { seasons: Array<{ id: string; gameId: string }> }) => {
    captured.seasons.push(props.seasons);
    return null;
  },
}));

import SchoolPortalClient from '../SchoolPortalClient';

const games = [
  { id: 'g1', slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' },
  { id: 'g2', slug: 'lol', displayName: 'League of Legends', shortName: 'LOL' },
];
const managedSeasons = [
  { id: 's1', name: '2026-27', gameId: 'g1', rescheduleAllowanceUsed: false },
  { id: 's2', name: '2026-27', gameId: 'g2', rescheduleAllowanceUsed: true },
];

function render(selectedGameId?: string): Array<{ id: string; gameId: string }> {
  captured.seasons.length = 0;
  renderToStaticMarkup(
    <SchoolPortalClient
      context={{ userId: 'u1', email: 'coach@example.edu', isStaffAdmin: false, managedSchools: [] } as never}
      activeSchool={
        {
          schoolId: 's1',
          schoolName: 'Test High',
          schoolSlug: 'test-high',
          managedGames: null,
          isPrimaryContact: false,
          affiliations: [],
        } as never
      }
      games={games}
      initialInvites={[]}
      initialSubmissions={[]}
      initialRosters={[]}
      matches={[]}
      matchesNowIso="2026-11-06T12:00:00.000Z"
      managedSeasons={managedSeasons}
      selectedGameId={selectedGameId}
      tourCompleted
    />
  );
  return captured.seasons[captured.seasons.length - 1];
}

describe('SchoolPortalClient: banner seasons follow the game filter', () => {
  it('passes every managed season when no game is selected', () => {
    expect(render().map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('passes only the selected game’s seasons', () => {
    expect(render('g1').map((s) => s.id)).toEqual(['s1']);
    expect(render('g2').map((s) => s.id)).toEqual(['s2']);
  });
});
