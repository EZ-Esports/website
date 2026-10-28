// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  reviewPlayerInvite: vi.fn(),
  getRosterEligibility: vi.fn(),
  emergencySwapSub: vi.fn(),
  enrollPlayerToRoster: vi.fn(),
  removePlayerFromRoster: vi.fn(),
  movePlayerToRoster: vi.fn(),
  updateRosterPlayerRole: vi.fn(),
  createSchoolRoster: vi.fn(),
  deleteSchoolRoster: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/portal-actions', () => actions);
vi.mock('../tour/PortalTour', () => ({ default: () => null }));
vi.mock('../components/GenerateInviteCard', () => ({ GenerateInviteCard: () => null }));
vi.mock('../components/MatchesSection', () => ({ MatchesSection: () => null }));

import SchoolPortalClient from '../SchoolPortalClient';

const alertSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('alert', alertSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const game = { id: 'g1', slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' };
const roster = {
  id: 'roster-1',
  teamId: 't1',
  seasonId: 'se1',
  seasonName: 'Fall 2026',
  name: 'Varsity',
  division: 'A',
  gameId: 'g1',
  gameName: 'Valorant',
  gameSlug: 'valorant',
  players: [
    { id: 'p1', memberId: 'm1', playerName: 'Ana Lee', ign: 'ana#1', role: 'player', isCaptain: false, discordUsername: 'ana', inGuild: true, riotVerified: true },
  ],
};

function setup() {
  render(
    <SchoolPortalClient
      context={{ userId: 'u1' } as never}
      activeSchool={
        { schoolId: 'sch1', schoolName: 'Test High', schoolSlug: 'test-high', managedGames: null, isPrimaryContact: true, affiliations: [] } as never
      }
      games={[game]}
      initialInvites={[]}
      initialSubmissions={[]}
      initialRosters={[roster]}
      matches={[]}
      matchesNowIso="2026-10-01T00:00:00.000Z"
      tourCompleted
    />,
  );
}

const trigger = () => screen.getByRole('button', { name: 'Remove Ana Lee from Varsity' });

describe('SchoolPortalClient: remove a player', () => {
  it('asks first, in the app, and states exactly what is deleted and that it cannot be undone', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(trigger());
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Remove Ana Lee from Varsity?');
    expect(dialog).toHaveTextContent('permanently deletes their roster spot');
    expect(dialog).toHaveTextContent('not on any other roster and have no match history');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    expect(actions.removePlayerFromRoster).not.toHaveBeenCalled();
  });

  it('cancelling never removes anybody', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(trigger());
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.removePlayerFromRoster).not.toHaveBeenCalled();
    expect(trigger()).toBeInTheDocument();
  });

  it('confirming removes once and shows the server\'s sentence about the student record', async () => {
    const user = userEvent.setup();
    actions.removePlayerFromRoster.mockResolvedValue({
      success: true,
      playerId: 'p1',
      studentRecord: 'deleted',
      message: 'The player was removed from the roster and their onboarding record was deleted.',
    });
    setup();
    await user.click(trigger());
    await user.click(await screen.findByRole('button', { name: 'Remove player' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.removePlayerFromRoster).toHaveBeenCalledTimes(1);
    expect(actions.removePlayerFromRoster).toHaveBeenCalledWith({ rosterId: 'roster-1', playerId: 'p1' });
    expect(screen.getByText('The player was removed from the roster and their onboarding record was deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Ana Lee from Varsity' })).toBeNull();
  });

  it('a failure stays in the dialog (no native alert) and keeps the player', async () => {
    const user = userEvent.setup();
    actions.removePlayerFromRoster.mockRejectedValue(new Error('Server Components render error'));
    setup();
    await user.click(trigger());
    await user.click(await screen.findByRole('button', { name: 'Remove player' }));
    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert).toHaveTextContent('Failed to remove player: Server Components render error');
    expect(alertSpy).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(trigger()).toBeInTheDocument();
  });
});
