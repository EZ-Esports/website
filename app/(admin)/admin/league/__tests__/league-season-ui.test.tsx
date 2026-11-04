// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  createGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
  createSeason: vi.fn(),
  updateSeason: vi.fn(),
  deleteSeason: vi.fn(),
  lockSeasonRosters: vi.fn(),
  unlockSeasonRosters: vi.fn(),
  publishSeasonOutcomes: vi.fn(),
  hideSeasonOutcomes: vi.fn(),
  addSchoolToSeason: vi.fn(),
}));
vi.mock('../actions', () => actions);
vi.mock('../season-schools-actions', () => ({ addSchoolToSeason: actions.addSchoolToSeason }));
// The manager modal pulls server actions; its own tests cover it.
vi.mock('@/app/components/admin/SchoolManagersModal', () => ({
  default: (p: { school: { name: string }; seasonName?: string }) => (
    <div role="dialog" aria-label="manager modal">{p.school.name} for {p.seasonName}</div>
  ),
}));

import LeagueSetupClient from '../LeagueSetupClient';
import SeasonSetupClient from '../[seasonId]/SeasonSetupClient';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const games = [
  { id: 'g1', displayName: 'Valorant', shortName: 'VAL', slug: 'valorant', imageUrl: null },
  { id: 'g2', displayName: 'League of Legends', shortName: 'LoL', slug: 'league-of-legends', imageUrl: null },
];
const seasons = [
  { id: 's1', gameId: 'g1', name: '2026-27', isActive: true },
  { id: 's2', gameId: 'g1', name: '2025-26', isActive: false, rostersLockedAt: '2026-01-01T00:00:00Z' },
  { id: 's3', gameId: 'g2', name: '2026-27', isActive: true },
];

describe('League Setup tabs', () => {
  it('shows one tab per game plus Manage games, with the selected game current', () => {
    render(<LeagueSetupClient games={games} seasons={seasons} view={{ kind: 'game', slug: 'valorant' }} seasonStatus="all" />);
    const nav = screen.getByRole('navigation', { name: 'Games' });
    expect(nav).toHaveTextContent('Valorant');
    expect(nav).toHaveTextContent('League of Legends');
    expect(nav).toHaveTextContent('Manage games');
    expect(screen.getByRole('link', { name: /^Valorant/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /^League of Legends/ })).toHaveAttribute('href', '/admin/league?game=league-of-legends');
  });

  it('lists only the selected game\'s seasons, each opening its own page', () => {
    render(<LeagueSetupClient games={games} seasons={seasons} view={{ kind: 'game', slug: 'valorant' }} seasonStatus="all" />);
    expect(screen.getByRole('link', { name: 'Open Valorant season 2026-27' })).toHaveAttribute('href', '/admin/league/s1');
    expect(screen.getByRole('link', { name: 'Open Valorant season 2025-26' })).toHaveAttribute('href', '/admin/league/s2');
    expect(screen.queryByRole('link', { name: /League of Legends season/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete game Valorant' })).toBeNull();
  });

  it('no longer offers lock or publish on a season row (they live inside the season)', () => {
    render(<LeagueSetupClient games={games} seasons={seasons} view={{ kind: 'game', slug: 'valorant' }} seasonStatus="all" />);
    expect(screen.queryByRole('button', { name: /Lock rosters|Unlock rosters|Publish season|Unpublish season/ })).toBeNull();
    // The locked state is still visible as a status chip.
    expect(screen.getByText('Rosters locked')).toBeInTheDocument();
  });

  it('keeps game management on its own tab', () => {
    render(<LeagueSetupClient games={games} seasons={seasons} view={{ kind: 'games' }} />);
    expect(screen.getByRole('button', { name: 'Delete game Valorant' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Valorant season/ })).toBeNull();
  });
});

describe('Season page', () => {
  const season = {
    id: 's1', name: '2026-27', isActive: true, standingsFormat: 'divided',
    rostersLockedAt: null as string | null, outcomesFinalizedAt: null as string | null,
    gameId: 'g1', gameName: 'Valorant', gameSlug: 'valorant',
  };
  const schools = [
    {
      schoolId: 'sc1', schoolName: 'Stuyvesant', logoUrl: null as string | null, teamId: 't1', missing: ['JV' as const],
      rosters: [{ id: 'r1', name: 'Varsity', division: 'Varsity' as const, players: [{ id: 'p1', name: 'Ada Lovelace', role: 'captain' }] }],
    },
  ];
  const baseProps = {
    season, schools, availableSchools: [{ id: 'sc2', name: 'Bronx Science' }], games: [{ id: 'g1', displayName: 'Valorant', slug: 'valorant' }],
    canInvite: true, matchesHref: '/admin/matches?season=s1',
  };

  it('shows each school as a tile with a summary, a crest fallback and a link to its season page', () => {
    render(<SeasonSetupClient {...baseProps} />);
    const link = screen.getByRole('link', { name: 'Stuyvesant' });
    expect(link).toHaveAttribute('href', '/admin/league/s1/schools/sc1?game=valorant');
    expect(screen.getByText('1 roster · 1 player')).toBeInTheDocument();
    expect(screen.getByText('Varsity · 1 player')).toBeInTheDocument();
    expect(screen.getByText('No JV roster')).toBeInTheDocument();
    expect(screen.getByText('ST')).toBeInTheDocument(); // crest fallback initials
    // Players are on the school page, not on the tile.
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
  });

  it('renders the uploaded crest when the school has one', () => {
    render(<SeasonSetupClient {...baseProps} schools={[{ ...schools[0], logoUrl: 'https://cdn.example/stuy.png' }]} />);
    expect(screen.getByRole('img', { name: 'Stuyvesant logo' })).toHaveAttribute('src', 'https://cdn.example/stuy.png');
  });

  it('adds the chosen school through the idempotent action', async () => {
    const user = userEvent.setup();
    actions.addSchoolToSeason.mockResolvedValue({ success: true, schoolName: 'Bronx Science', teamCreated: true, rostersCreated: ['Varsity', 'JV'] });
    render(<SeasonSetupClient {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Add school' })).toHaveAttribute('disabled');
    await user.selectOptions(screen.getByRole('combobox'), 'sc2');
    await user.click(screen.getByRole('button', { name: 'Add school' }));
    await waitFor(() => expect(actions.addSchoolToSeason).toHaveBeenCalledWith({ seasonId: 's1', schoolId: 'sc2' }));
    expect(await screen.findByText('Bronx Science added to Valorant 2026-27 with Varsity and JV rosters.')).toBeInTheDocument();
  });

  it('flags a school with a missing roster and repairs it with the same action', async () => {
    const user = userEvent.setup();
    actions.addSchoolToSeason.mockResolvedValue({ success: true, schoolName: 'Stuyvesant', teamCreated: false, rostersCreated: ['JV'] });
    render(<SeasonSetupClient {...baseProps} />);
    expect(screen.getByText('No JV roster')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create missing rosters' }));
    await waitFor(() => expect(actions.addSchoolToSeason).toHaveBeenCalledWith({ seasonId: 's1', schoolId: 'sc1' }));
  });

  it('locks rosters from inside the season after confirming', async () => {
    const user = userEvent.setup();
    actions.lockSeasonRosters.mockResolvedValue({ success: true });
    render(<SeasonSetupClient {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Lock rosters for season 2026-27' }));
    expect(actions.lockSeasonRosters).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Lock rosters' }));
    await waitFor(() => expect(actions.lockSeasonRosters).toHaveBeenCalledWith('s1'));
  });

  it('publishes the season from inside the season after confirming', async () => {
    const user = userEvent.setup();
    actions.publishSeasonOutcomes.mockResolvedValue({ success: true });
    render(<SeasonSetupClient {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Publish season 2026-27' }));
    await user.click(await screen.findByRole('button', { name: 'Publish season' }));
    await waitFor(() => expect(actions.publishSeasonOutcomes).toHaveBeenCalledWith('s1'));
  });

  it('opens managers and invites scoped to this season, and hides them without permission', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SeasonSetupClient {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Managers and invite links for Stuyvesant' }));
    expect(screen.getByRole('dialog', { name: 'manager modal' })).toHaveTextContent('Stuyvesant for 2026-27');
    rerender(<SeasonSetupClient {...baseProps} canInvite={false} />);
    expect(screen.queryByRole('button', { name: /Managers and invite links/ })).toBeNull();
  });

  it('game-aware copy: description and toasts name only this game\'s rosters', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SeasonSetupClient {...baseProps} />);
    expect(screen.getByText(/Valorant team for 2026-27 and creates the rosters this game fields \(Varsity and JV rosters\)/)).toBeInTheDocument();
    rerender(<SeasonSetupClient {...baseProps} season={{ ...season, gameName: 'Minecraft', gameSlug: 'minecraft' }} />);
    expect(screen.getByText(/\(Varsity roster\)/)).toBeInTheDocument();

    actions.addSchoolToSeason.mockResolvedValue({ success: true, schoolName: 'Bronx Science', teamCreated: true, rostersCreated: ['Varsity'] });
    await user.selectOptions(screen.getByRole('combobox'), 'sc2');
    await user.click(screen.getByRole('button', { name: 'Add school' }));
    expect(await screen.findByText('Bronx Science added to Minecraft 2026-27 with Varsity roster.')).toBeInTheDocument();
  });
});
