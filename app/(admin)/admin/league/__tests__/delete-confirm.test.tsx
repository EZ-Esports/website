// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
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
}));
vi.mock('../actions', () => actions);

import LeagueSetupClient from '../LeagueSetupClient';

const confirmSpy = vi.fn(() => true);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const games = [{ id: 'g1', displayName: 'Valorant', shortName: 'VAL', slug: 'valorant', imageUrl: null }];
const seasons = [{ id: 's1', gameId: 'g1', name: 'Fall 2026', isActive: true }];

function setup() {
  render(<LeagueSetupClient games={games} seasons={seasons} />);
}

describe('LeagueSetupClient: delete game', () => {
  it('cancelling does not call deleteGame and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Delete game Valorant' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Permanently delete "Valorant"? This also deletes all of its seasons and, with them, every team, roster spot, match, result and standing in those seasons. Students and schools are not deleted. This cannot be undone.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deleteGame).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete game Valorant' })).toHaveFocus());
  });

  it('confirming calls deleteGame once with the id and is disabled while pending', async () => {
    const user = userEvent.setup();
    let release!: (v: { success: boolean }) => void;
    actions.deleteGame.mockReturnValue(new Promise((r) => (release = r)));
    setup();
    await user.click(screen.getByRole('button', { name: 'Delete game Valorant' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const busy = await screen.findByRole('button', { name: /Deleting/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(actions.deleteGame).toHaveBeenCalledTimes(1);
    expect(actions.deleteGame).toHaveBeenCalledWith('g1');
    await act(async () => release({ success: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await screen.findByText('Game deleted.')).toBeInTheDocument();
  });

  it('shows a failed deletion in the dialog', async () => {
    const user = userEvent.setup();
    actions.deleteGame.mockResolvedValue({ success: false, error: 'Game still has matches.' });
    setup();
    await user.click(screen.getByRole('button', { name: 'Delete game Valorant' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Game still has matches.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('LeagueSetupClient: delete season (dynamic message)', () => {
  it('uses the season name in the message, never calls on cancel, and calls once with the id on confirm', async () => {
    const user = userEvent.setup();
    actions.deleteSeason.mockResolvedValue({ success: true });
    setup();
    await user.click(screen.getByRole('button', { name: 'Delete season Fall 2026' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Permanently delete season "Fall 2026"? This also deletes its teams, rosters and standings. A season with matches cannot be deleted until those matches are removed. Students are not deleted. This cannot be undone.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deleteSeason).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete season Fall 2026' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(actions.deleteSeason).toHaveBeenCalledTimes(1));
    expect(actions.deleteSeason).toHaveBeenCalledWith('s1');
    expect(actions.deleteGame).not.toHaveBeenCalled();
  });
});
