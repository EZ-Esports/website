// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/app/lib/onboarding/reschedule-actions', () => ({
  requestReschedule: vi.fn(),
  respondToReschedule: vi.fn(),
  counterReschedule: vi.fn(),
  cancelReschedule: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/match-result-actions', () => ({
  cancelPendingResult: vi.fn(),
  getMatchScoreboardAction: vi.fn(),
  retryMatchResult: vi.fn(),
  submitMatchResult: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { MatchesSection } from '../MatchesSection';
import { StaffActingProvider } from '../StaffActing';
import type { ManagedSeasonItem, SchoolMatchItem } from '@/app/lib/school-matches';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const NOW_ISO = '2026-11-06T12:00:00.000Z';

const season = (over: Partial<ManagedSeasonItem> = {}): ManagedSeasonItem => ({
  id: 'season-1',
  name: '2026-27',
  gameId: 'g1',
  rescheduleAllowanceUsed: false,
  ...over,
});

const oneMatch: SchoolMatchItem = {
  id: 'm1',
  gameId: 'g1',
  gameName: 'Valorant',
  gameSlug: 'valorant',
  seasonName: '2026-27',
  division: 'Varsity',
  scheduledAt: '2026-12-01T00:00:00.000Z',
  status: 'scheduled',
  opponentName: 'Other High',
  isHome: true,
  ownScore: null,
  opponentScore: null,
  sameSchool: false,
  reschedule: null,
  rescheduledFrom: null,
  rescheduleAllowanceUsed: false,
  gameCount: 0,
  pendingResult: null,
};

function renderSection(opts: { matches?: SchoolMatchItem[]; seasons: ManagedSeasonItem[]; isStaff?: boolean }) {
  return render(
    <StaffActingProvider isStaff={!!opts.isStaff} schoolName="Test High">
      <MatchesSection
        matches={opts.matches ?? []}
        seasons={opts.seasons}
        schoolId="school-a"
        viewOnlyGameIds={[]}
        nowIso={NOW_ISO}
        showGame={false}
      />
    </StaffActingProvider>
  );
}

describe('MatchesSection reschedule banner', () => {
  it('shows the banner for a season with no matches, unused', () => {
    renderSection({ seasons: [season()] });
    expect(screen.getByText('2026-27: Reschedules remaining 1 of 1')).toBeTruthy();
    expect(screen.getByText('Your school can request one reschedule for this season.')).toBeTruthy();
  });

  it('shows the used state for a season with no matches', () => {
    renderSection({ seasons: [season({ rescheduleAllowanceUsed: true })] });
    expect(screen.getByText('2026-27: Reschedules remaining 0 of 1')).toBeTruthy();
    expect(screen.getByText('Your school has used its one reschedule for this season.')).toBeTruthy();
  });

  it('shows one banner per in-scope season, alongside a season that has matches', () => {
    renderSection({
      matches: [oneMatch],
      seasons: [season(), season({ id: 'season-2', name: '2027-28', gameId: 'g2', rescheduleAllowanceUsed: true })],
    });
    expect(screen.getByText('2026-27: Reschedules remaining 1 of 1')).toBeTruthy();
    expect(screen.getByText('2027-28: Reschedules remaining 0 of 1')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('keeps the banner when every match is completed', () => {
    renderSection({
      matches: [{ ...oneMatch, status: 'completed', ownScore: 2, opponentScore: 1 }],
      seasons: [season()],
    });
    expect(screen.getByText('2026-27: Reschedules remaining 1 of 1')).toBeTruthy();
  });

  it('hides the banner from staff', () => {
    renderSection({ seasons: [season()], isStaff: true });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/Reschedules remaining/)).toBeNull();
  });

  it('shows no banner when there are no in-scope seasons', () => {
    renderSection({ seasons: [] });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
