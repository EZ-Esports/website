// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, act, within } from '@testing-library/react';
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

const confirmSpy = vi.fn(() => true);
const alertSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
  vi.stubGlobal('alert', alertSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const game = { id: 'g1', slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' };
const emptyRoster = {
  id: 'roster-1',
  teamId: 't1',
  seasonId: 'se1',
  seasonName: 'Fall 2026',
  name: 'Varsity',
  division: 'A',
  gameId: 'g1',
  gameName: 'Valorant',
  gameSlug: 'valorant',
  players: [],
};

function setup() {
  render(
    <SchoolPortalClient
      context={{ userId: 'u1' } as never}
      activeSchool={
        {
          schoolId: 'sch1',
          schoolName: 'Test High',
          schoolSlug: 'test-high',
          managedGames: null,
          isPrimaryContact: true,
          affiliations: [],
        } as never
      }
      games={[game]}
      initialInvites={[]}
      initialSubmissions={[]}
      initialRosters={[emptyRoster]}
      matches={[]}
      matchesNowIso="2026-10-01T00:00:00.000Z"
      tourCompleted
    />,
  );
}

const trigger = () => screen.getByRole('button', { name: 'Delete empty roster' });

describe('SchoolPortalClient: delete empty roster', () => {
  it('cancelling does not call deleteSchoolRoster and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(trigger());
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Are you sure you want to delete this empty roster?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deleteSchoolRoster).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it('confirming calls deleteSchoolRoster once with the roster id, is disabled while pending, and removes the roster', async () => {
    const user = userEvent.setup();
    let release!: (v: { success: boolean }) => void;
    actions.deleteSchoolRoster.mockReturnValue(new Promise((r) => (release = r)));
    setup();
    await user.click(trigger());
    await user.click(await screen.findByRole('button', { name: 'Delete roster' }));
    const busy = await screen.findByRole('button', { name: /Deleting/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(actions.deleteSchoolRoster).toHaveBeenCalledTimes(1);
    expect(actions.deleteSchoolRoster).toHaveBeenCalledWith('roster-1');
    await act(async () => release({ success: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete empty roster' })).toBeNull();
  });

  it('shows the failure in the dialog and in the roster notice, and keeps the roster', async () => {
    const user = userEvent.setup();
    actions.deleteSchoolRoster.mockRejectedValue(new Error('Cannot delete a roster with enrolled players.'));
    setup();
    await user.click(trigger());
    await user.click(await screen.findByRole('button', { name: 'Delete roster' }));
    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert).toHaveTextContent('Cannot delete a roster with enrolled players.');
    // One copy in the dialog, one in the section notice that outlives the dialog.
    expect(screen.getAllByText('Cannot delete a roster with enrolled players.')).toHaveLength(2);
    expect(alertSpy).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(trigger()).toBeInTheDocument();
  });
});
