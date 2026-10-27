// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  reorderRoles: vi.fn(),
  inviteStaff: vi.fn(),
  revokeInvite: vi.fn(),
  revokeStaff: vi.fn(),
  updateUserRoles: vi.fn(),
}));
vi.mock('@/app/(admin)/admin/team/actions', () => actions);

import TeamManagerClient from '../TeamManagerClient';

const confirmSpy = vi.fn(() => true);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const roles = [
  { id: 'r-owner', name: 'Owner', color: '#f43f5e', permissions: '0', position: 100, isOwner: true, isSystem: true },
  { id: 'r-ops', name: 'League Ops', color: '#3b82f6', permissions: '0', position: 50, isOwner: false, isSystem: false },
];

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  render(
    <TeamManagerClient
      current={{ id: 'u1', email: 'owner@example.com', permissions: '0', isOwner: true, highestRolePosition: 100 }}
      staffMembers={[]}
      invites={[]}
      roles={roles}
    />,
  );
  await user.click(screen.getByRole('tab', { name: /Roles/ }));
  await user.click(await screen.findByRole('button', { name: 'League Ops' }));
  await user.click(await screen.findByRole('button', { name: 'Delete role League Ops' }));
  return screen.findByRole('alertdialog');
}

describe('TeamManagerClient: delete role', () => {
  it('cancelling does not call deleteRole and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const dialog = await openDeleteDialog(user);
    expect(dialog).toHaveTextContent(
      'Are you sure you want to delete this role? This action cannot be undone and will strip the role from all users.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deleteRole).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete role League Ops' })).toHaveFocus());
  });

  it('confirming calls deleteRole once with the role id and is disabled while pending', async () => {
    const user = userEvent.setup();
    let release!: (v: { success: boolean }) => void;
    actions.deleteRole.mockReturnValue(new Promise((r) => (release = r)));
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete role' }));
    const busy = await screen.findByRole('button', { name: /Deleting/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(actions.deleteRole).toHaveBeenCalledTimes(1);
    expect(actions.deleteRole).toHaveBeenCalledWith('r-ops');
    await act(async () => release({ success: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('shows a failed deletion in the dialog', async () => {
    const user = userEvent.setup();
    actions.deleteRole.mockResolvedValue({ success: false, error: 'Role is still assigned.' });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Role is still assigned.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
