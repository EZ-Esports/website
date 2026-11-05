// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveManagersTab } from '../school-managers/ActiveManagersTab';
import { AdminNotice } from '../AdminUI';

afterEach(cleanup);

const manager = {
  id: 'mgr-1', schoolId: 's1', userId: 'user-1234567890', managedGames: null, academicYear: '2026-27',
  isPrimaryContact: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@school.edu',
};
const games = [
  { id: 'g1', displayName: 'Valorant', slug: 'valorant' },
  { id: 'g2', displayName: 'League of Legends', slug: 'league-of-legends' },
];

function setup(onUpdateManager = vi.fn().mockResolvedValue({ success: true })) {
  const onSuccess = vi.fn();
  render(
    <ActiveManagersTab
      managers={[manager]} loading={false} isRemovingId={null} onRemoveManager={vi.fn()}
      games={games} onUpdateManager={onUpdateManager} onSuccess={onSuccess} onError={vi.fn()}
    />,
  );
  return { onUpdateManager, onSuccess };
}

describe('editing a manager\'s access', () => {
  it('saves a game scope and the primary flag, then reports success', async () => {
    const user = userEvent.setup();
    const { onUpdateManager, onSuccess } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit access for Ada Lovelace' }));
    await user.click(screen.getByRole('radio', { name: 'Specific games only' }));
    await user.click(screen.getByRole('checkbox', { name: 'League of Legends' }));
    await user.click(screen.getByRole('checkbox', { name: /Primary school contact/ }));
    await user.click(screen.getByRole('button', { name: 'Save access' }));
    await waitFor(() => expect(onUpdateManager).toHaveBeenCalledWith('mgr-1', ['league-of-legends'], true));
    expect(onSuccess).toHaveBeenCalledWith('Access updated for Ada Lovelace.');
  });

  it('will not save a specific-games scope with no game chosen', async () => {
    const user = userEvent.setup();
    const { onUpdateManager } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit access for Ada Lovelace' }));
    await user.click(screen.getByRole('radio', { name: 'Specific games only' }));
    await user.click(screen.getByRole('button', { name: 'Save access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one game');
    expect(onUpdateManager).not.toHaveBeenCalled();
  });

  it('the trigger is a RAC disclosure: expanded state and panel are exposed, and Cancel / Save close it', async () => {
    const user = userEvent.setup();
    setup();
    const toggle = screen.getByRole('button', { name: 'Edit access for Ada Lovelace' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('group', { name: 'Edit access for Ada Lovelace' });
    expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.queryByRole('radio', { name: 'All games' })).toBeNull();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Save access' }));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
  });

  it('dialog banners are live regions (status for success, alert for errors)', () => {
    render(
      <>
        <AdminNotice tone="success">Saved</AdminNotice>
        <AdminNotice tone="danger">Failed</AdminNotice>
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('shows the server error and stays open', async () => {
    const user = userEvent.setup();
    setup(vi.fn().mockResolvedValue({ success: false, error: 'Nope.' }));
    await user.click(screen.getByRole('button', { name: 'Edit access for Ada Lovelace' }));
    await user.click(screen.getByRole('button', { name: 'Save access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });
});
