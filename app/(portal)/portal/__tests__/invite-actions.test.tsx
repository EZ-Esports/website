// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  reviewPlayerInvite: vi.fn(),
  getRosterEligibility: vi.fn(),
  enrollPlayerToRoster: vi.fn(),
  removePlayerFromRoster: vi.fn(),
  movePlayerToRoster: vi.fn(),
  updateRosterPlayerRole: vi.fn(),
  createSchoolRoster: vi.fn(),
  deleteSchoolRoster: vi.fn(),
  regeneratePlayerInviteLink: vi.fn(),
  deletePlayerInvite: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/portal-actions', () => actions);
vi.mock('../tour/PortalTour', () => ({ default: () => null }));
vi.mock('../components/GenerateInviteCard', () => ({ GenerateInviteCard: () => null }));
vi.mock('../components/MatchesSection', () => ({ MatchesSection: () => null }));

import SchoolPortalClient from '../SchoolPortalClient';

const writeText = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
});
afterEach(cleanup);

const game = { id: 'g1', slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' };
const invite = {
  id: 'inv-1',
  schoolId: 'sch1',
  gameId: 'g1',
  intendedFirstName: 'Jordan',
  intendedLastName: 'Lee',
  status: 'pending',
  expiresAt: new Date('2026-11-01T00:00:00Z'),
  submittedAt: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: new Date('2026-10-20T00:00:00Z'),
  schoolSlug: 'test-high',
  gameSlug: 'valorant',
  gameName: 'Valorant',
};

function setup() {
  // user-event installs its own clipboard stub in userEvent.setup(); replace it afterwards.
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
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
      initialInvites={[invite as never]}
      initialSubmissions={[]}
      initialRosters={[]}
      matches={[]}
      matchesNowIso="2026-10-01T00:00:00.000Z"
      tourCompleted
    />,
  );
}

const copyBtn = () => screen.getByRole('button', { name: /Copy a new invite link for Jordan Lee/ });
const deleteBtn = () => screen.getByRole('button', { name: /Delete invite for Jordan Lee/ });
const newExpiry = new Date('2026-11-09T00:00:00Z');

describe('SchoolPortalClient: invite copy link', () => {
  it('confirm -> regenerate -> clipboard gets the full new URL, row shows Copied, status announced', async () => {
    const user = userEvent.setup();
    actions.regeneratePlayerInviteLink.mockResolvedValue({
      success: true,
      inviteId: 'inv-1',
      inviteUrl: '/join/test-high/valorant?token=abc',
      expiresAt: newExpiry,
    });
    setup();
    await user.click(copyBtn());
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Jordan Lee. The old link will stop working');
    expect(dialog).not.toHaveTextContent('Jordan Lee .');
    expect(actions.regeneratePlayerInviteLink).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Copy new link' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.regeneratePlayerInviteLink).toHaveBeenCalledTimes(1);
    expect(actions.regeneratePlayerInviteLink).toHaveBeenCalledWith('inv-1');
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/test-high/valorant?token=abc`);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toContain('Link copied');
    // The row's expiry reflects the renewed link.
    expect(screen.getByText(newExpiry.toLocaleDateString())).toBeInTheDocument();
  });

  it('cancelling does not regenerate', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(copyBtn());
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.regeneratePlayerInviteLink).not.toHaveBeenCalled();
  });

  it('clipboard refusal shows the link in a focused field and announces the failure', async () => {
    const user = userEvent.setup();
    writeText.mockRejectedValue(new Error('denied'));
    actions.regeneratePlayerInviteLink.mockResolvedValue({
      success: true,
      inviteId: 'inv-1',
      inviteUrl: '/join/test-high/valorant?token=abc',
      expiresAt: newExpiry,
    });
    setup();
    await user.click(copyBtn());
    await user.click(await screen.findByRole('button', { name: 'Copy new link' }));
    const field = await screen.findByLabelText(/copy manually/);
    expect(field).toHaveValue(`${window.location.origin}/join/test-high/valorant?token=abc`);
    await waitFor(() => expect(field).toHaveFocus());
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toContain('Copy failed, link shown below');
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('a returned refusal is shown in the dialog and a not-pending status corrects the row', async () => {
    const user = userEvent.setup();
    actions.regeneratePlayerInviteLink.mockResolvedValue({
      success: false,
      error: 'Only pending invites can be changed.',
      status: 'submitted',
    });
    setup();
    await user.click(copyBtn());
    await user.click(await screen.findByRole('button', { name: 'Copy new link' }));
    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert).toHaveTextContent('Only pending invites can be changed.');
    expect(writeText).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy a new invite link/ })).toBeNull();
  });
});

describe('SchoolPortalClient: invite delete', () => {
  it('cancelling does not delete; confirming deletes once and removes the row', async () => {
    const user = userEvent.setup();
    actions.deletePlayerInvite.mockResolvedValue({ success: true, inviteId: 'inv-1' });
    setup();
    await user.click(deleteBtn());
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete the invite for Jordan Lee? Its link will stop working.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deletePlayerInvite).not.toHaveBeenCalled();

    await user.click(deleteBtn());
    await user.click(await screen.findByRole('button', { name: 'Delete invite' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deletePlayerInvite).toHaveBeenCalledTimes(1);
    expect(actions.deletePlayerInvite).toHaveBeenCalledWith('inv-1');
    expect(screen.queryByRole('button', { name: /Delete invite for/ })).toBeNull();
    expect(screen.getByText(/No invites generated yet/)).toBeInTheDocument();
  });

  it('a refusal stays in the dialog and keeps the row; a vanished invite is removed', async () => {
    const user = userEvent.setup();
    actions.deletePlayerInvite.mockResolvedValue({ success: false, error: 'Invite not found.', status: null });
    setup();
    await user.click(deleteBtn());
    await user.click(await screen.findByRole('button', { name: 'Delete invite' }));
    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert).toHaveTextContent('Invite not found.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText(/No invites generated yet/)).toBeInTheDocument();
  });
});
