// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  createPlayer: vi.fn(),
  createRoster: vi.fn(),
  createTeam: vi.fn(),
  deleteRoster: vi.fn(),
  deleteRosterMember: vi.fn(),
  moveRosterMember: vi.fn(),
  updatePlayer: vi.fn(),
  updateRoster: vi.fn(),
}));
vi.mock('@/app/(admin)/admin/schools/[schoolId]/rosters/actions', () => actions);

import { DeleteRosterButton, PlayerRowActions, RosterEditProvider } from '../SchoolRosterEditors';

const notify = vi.fn();
const player = { id: 'p1', name: 'Ana Lee', role: 'player' } as never;

function renderRow() {
  return render(
    <RosterEditProvider
      value={{ schoolId: 's1', options: { members: [], games: [], seasons: [] }, pending: false, run: vi.fn(), notify }}
    >
      <PlayerRowActions player={player} rosterName="Varsity" siblings={[]} onEdit={vi.fn()} />
    </RosterEditProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('staff: removing a player from a roster', () => {
  it('the confirmation says what is deleted, when the student record goes too, and that it cannot be undone', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole('button', { name: 'Remove player Ana Lee' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Remove Ana Lee from Varsity?');
    expect(dialog).toHaveTextContent('permanently deletes their roster spot');
    expect(dialog).toHaveTextContent('not on any other roster and have no match history');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    expect(dialog).not.toHaveTextContent(/stay in the school's member list/i);
  });

  it('cancelling never calls the action', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole('button', { name: 'Remove player Ana Lee' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deleteRosterMember).not.toHaveBeenCalled();
  });

  it('confirming calls the action once and shows the server\'s outcome sentence', async () => {
    const user = userEvent.setup();
    actions.deleteRosterMember.mockResolvedValue({
      success: true,
      studentRecord: 'kept',
      message: 'The player was removed from the roster. Their student record was kept because they have match history.',
    });
    renderRow();
    await user.click(screen.getByRole('button', { name: 'Remove player Ana Lee' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(actions.deleteRosterMember).toHaveBeenCalledTimes(1);
    expect(actions.deleteRosterMember).toHaveBeenCalledWith('s1', 'p1');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('student record was kept because they have match history'));
  });
});

describe('staff: deleting a roster', () => {
  it('says the student records of players on no other roster are deleted too', async () => {
    const user = userEvent.setup();
    render(
      <RosterEditProvider
        value={{ schoolId: 's1', options: { members: [], games: [], seasons: [] }, pending: false, run: vi.fn(), notify }}
      >
        <DeleteRosterButton roster={{ id: 'r1', name: 'JV', players: [{}, {}] } as never} />
      </RosterEditProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete roster JV' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('its 2 players');
    expect(dialog).toHaveTextContent('on no other roster has their student record');
    expect(dialog).toHaveTextContent('This cannot be undone.');
  });
});
