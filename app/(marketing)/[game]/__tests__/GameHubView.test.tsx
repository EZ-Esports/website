import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameHubView from '../GameHubView';
import { getGameHubData, getGameTournaments } from '@/app/lib/db/queries';

vi.mock('@/app/lib/db/queries', () => ({
  getGameHubData: vi.fn(),
  getGameTournaments: vi.fn(),
}));

describe('GameHubView Season Badge (Issue #318)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGameTournaments).mockResolvedValue([]);
  });

  it('renders the active season badge with seasonName and without " · Latest"', async () => {
    vi.mocked(getGameHubData).mockResolvedValue({
      division: 'Varsity',
      nextMatch: null,
      recentResults: [],
      topTeams: [],
      seasonName: 'Fall 2026',
      standingsFormat: 'divided',
      standingsReconstructed: false,
      outcomesPublic: true,
    });

    const jsx = await GameHubView({
      params: Promise.resolve({ game: 'valorant' }),
      division: 'Varsity',
    });
    const html = renderToStaticMarkup(jsx);

    // Verify season badge renders season name directly
    expect(html).toContain('Fall 2026');
    // Verify "Latest" suffix is removed
    expect(html).not.toContain('Fall 2026 · Latest');
    expect(html).not.toContain(' · Latest');
    expect(html).not.toContain('Latest');
  });

  it('does not render season badge when seasonName is null', async () => {
    vi.mocked(getGameHubData).mockResolvedValue({
      division: 'Varsity',
      nextMatch: null,
      recentResults: [],
      topTeams: [],
      seasonName: null,
      standingsFormat: 'divided',
      standingsReconstructed: false,
      outcomesPublic: true,
    });

    const jsx = await GameHubView({
      params: Promise.resolve({ game: 'valorant' }),
      division: 'Varsity',
    });
    const html = renderToStaticMarkup(jsx);

    expect(html).not.toContain('Latest');
  });
});
