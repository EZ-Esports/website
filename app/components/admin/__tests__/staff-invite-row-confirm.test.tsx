// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  revokeInvite: vi.fn(),
  revokeStaff: vi.fn(),
  updateUserRoles: vi.fn(),
}));
vi.mock('@/app/(admin)/admin/team/actions', () => actions);

import InviteRow from '../InviteRow';
import StaffRow from '../StaffRow';

const confirmSpy = vi.fn(() => true);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const role = { id: 'r1', name: 'Ops', color: '#3b82f6', position: 10 };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('InviteRow: cancel pending staff invite', () => {
  function setup() {
    render(
      <ul>
        <InviteRow
          invite={{ id: 'inv-7', email: 'new@ezesports.org', roles: [role], expiresAt: new Date('2030-01-01') }}
          expired={false}
          canRevoke
        />
      </ul>,
    );
  }
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'More actions for new@ezesports.org' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cancel Invite' }));
    return screen.findByRole('alertdialog');
  }

  it('cancelling does not call the action and returns focus to the menu button', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Cancel the pending invite for new@ezesports.org? The link will stop working.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.revokeInvite).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'More actions for new@ezesports.org' })).toHaveFocus(),
    );
  });

  it('confirming calls the action once with the invite id and is disabled while pending', async () => {
    const user = userEvent.setup();
    const d = deferred<{ success: boolean }>();
    actions.revokeInvite.mockReturnValue(d.promise);
    setup();
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Cancel invite' }));
    const busy = await screen.findByRole('button', { name: /Cancelling/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(actions.revokeInvite).toHaveBeenCalledTimes(1);
    expect(actions.revokeInvite).toHaveBeenCalledWith('inv-7');
    await act(async () => d.resolve({ success: true }));
    await waitFor(() => expect(screen.queryByText('new@ezesports.org')).toBeNull());
  });

  it('shows the failure and keeps the invite', async () => {
    const user = userEvent.setup();
    actions.revokeInvite.mockResolvedValue({ success: false, error: 'Invite was already used.' });
    setup();
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Cancel invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invite was already used.');
    expect(screen.getByText('new@ezesports.org')).toBeInTheDocument();
  });
});

describe('StaffRow: revoke staff access', () => {
  function setup() {
    render(
      <ul>
        <StaffRow
          member={{ userId: 'u-9', email: 'ops@ezesports.org', roles: [role], createdAt: new Date('2026-01-01') }}
          isSelf={false}
          canRevoke
          assignableRoles={[]}
        />
      </ul>,
    );
  }
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'More actions for ops@ezesports.org' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove Access' }));
    return screen.findByRole('alertdialog');
  }

  it('cancelling does not call the action and returns focus to the menu button', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Revoke staff access for ops@ezesports.org? Their portal identity will be removed.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.revokeStaff).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'More actions for ops@ezesports.org' })).toHaveFocus(),
    );
  });

  it('confirming calls the action once with the user id and is disabled while pending', async () => {
    const user = userEvent.setup();
    const d = deferred<{ success: boolean }>();
    actions.revokeStaff.mockReturnValue(d.promise);
    setup();
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Revoke access' }));
    const busy = await screen.findByRole('button', { name: /Revoking/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(actions.revokeStaff).toHaveBeenCalledTimes(1);
    expect(actions.revokeStaff).toHaveBeenCalledWith('u-9');
    await act(async () => d.resolve({ success: true }));
    await waitFor(() => expect(screen.queryByText('ops@ezesports.org')).toBeNull());
  });

  it('shows the failure and keeps the member', async () => {
    const user = userEvent.setup();
    actions.revokeStaff.mockResolvedValue({ success: false, error: 'You cannot revoke a higher role.' });
    setup();
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Revoke access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot revoke a higher role.');
    expect(screen.getByText('ops@ezesports.org')).toBeInTheDocument();
  });
});
