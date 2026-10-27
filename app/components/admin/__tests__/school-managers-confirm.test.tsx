// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const m = vi.hoisted(() => ({
  getSchoolManagers: vi.fn(),
  getSchoolManagerInvites: vi.fn(),
  getRegisteredManagers: vi.fn(),
  removeSchoolManager: vi.fn(),
  revokeManagerInvite: vi.fn(),
  generateManagerInvite: vi.fn(),
}));
vi.mock('@/app/(admin)/admin/schools/manager-actions', () => m);

import { ActiveManagersTab } from '../school-managers/ActiveManagersTab';
import { ProvisionInviteTab } from '../school-managers/ProvisionInviteTab';
import { useSchoolManagersData } from '../school-managers/useSchoolManagersData';

const confirmSpy = vi.fn(() => true);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
  m.getSchoolManagers.mockResolvedValue([]);
  m.getSchoolManagerInvites.mockResolvedValue([]);
  m.getRegisteredManagers.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const manager = {
  id: 'mgr-1',
  schoolId: 's1',
  userId: 'user-1234567890',
  managedGames: null,
  academicYear: '2026-27',
  isPrimaryContact: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@school.edu',
};
const invite = {
  id: 'inv-1',
  schoolId: 's1',
  intendedFirstName: 'Grace',
  intendedLastName: 'Hopper',
  status: 'pending',
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  submittedAt: null,
  submissionDraft: null,
};

describe('ActiveManagersTab: remove manager', () => {
  function setup(onRemoveManager = vi.fn().mockResolvedValue({ success: true }), isRemovingId: string | null = null) {
    const onError = vi.fn();
    render(
      <ActiveManagersTab
        managers={[manager]}
        loading={false}
        isRemovingId={isRemovingId}
        onRemoveManager={onRemoveManager}
        onError={onError}
      />,
    );
    return { onRemoveManager, onError };
  }

  it('cancelling does not call the action', async () => {
    const user = userEvent.setup();
    const { onRemoveManager } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove manager Ada Lovelace' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Are you sure you want to remove manager access for Ada Lovelace?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onRemoveManager).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('confirming calls the action exactly once with the manager id, even on a double press', async () => {
    const user = userEvent.setup();
    let release!: (v: { success: boolean }) => void;
    const onRemoveManager = vi.fn(() => new Promise<{ success: boolean }>((r) => (release = r)));
    setup(onRemoveManager);
    await user.click(screen.getByRole('button', { name: 'Remove manager Ada Lovelace' }));
    await user.click(await screen.findByRole('button', { name: 'Remove access' }));
    const busy = await screen.findByRole('button', { name: /Removing/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(onRemoveManager).toHaveBeenCalledTimes(1);
    expect(onRemoveManager).toHaveBeenCalledWith('mgr-1');
    await act(async () => release({ success: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('shows the failure in the dialog and reports it through onError', async () => {
    const user = userEvent.setup();
    const { onError } = setup(vi.fn().mockResolvedValue({ success: false, error: 'Cannot remove the last manager.' }));
    await user.click(screen.getByRole('button', { name: 'Remove manager Ada Lovelace' }));
    await user.click(await screen.findByRole('button', { name: 'Remove access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot remove the last manager.');
    expect(onError).toHaveBeenCalledWith('Cannot remove the last manager.');
  });

  it('keeps the row trigger disabled while that manager is being removed', () => {
    setup(undefined, 'mgr-1');
    expect(screen.getByRole('button', { name: 'Remove manager Ada Lovelace' })).toBeDisabled();
  });
});

describe('ProvisionInviteTab: revoke invite', () => {
  function setup(onRevokeInvite = vi.fn().mockResolvedValue({ success: true }), isRevokingId: string | null = null) {
    const onError = vi.fn();
    render(
      <ProvisionInviteTab
        schoolId="s1"
        games={[]}
        invites={[invite]}
        isRevokingId={isRevokingId}
        onRevokeInvite={onRevokeInvite}
        onRefresh={vi.fn()}
        onError={onError}
        onSuccess={vi.fn()}
      />,
    );
    return { onRevokeInvite, onError };
  }

  it('cancelling does not call the action', async () => {
    const user = userEvent.setup();
    const { onRevokeInvite } = setup();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Are you sure you want to revoke the invite for Grace Hopper?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onRevokeInvite).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('confirming calls the action exactly once with the invite id and disables while pending', async () => {
    const user = userEvent.setup();
    let release!: (v: { success: boolean }) => void;
    const onRevokeInvite = vi.fn(() => new Promise<{ success: boolean }>((r) => (release = r)));
    setup(onRevokeInvite);
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke invite' }));
    const busy = await screen.findByRole('button', { name: /Revoking/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(onRevokeInvite).toHaveBeenCalledTimes(1);
    expect(onRevokeInvite).toHaveBeenCalledWith('inv-1');
    await act(async () => release({ success: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('shows the failure in the dialog and reports it through onError', async () => {
    const user = userEvent.setup();
    const { onError } = setup(vi.fn().mockResolvedValue({ success: false, error: 'Invite already accepted.' }));
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invite already accepted.');
    expect(onError).toHaveBeenCalledWith('Invite already accepted.');
  });

  it('disables the row Revoke button while that invite is being revoked', () => {
    setup(undefined, 'inv-1');
    expect(screen.getByRole('button', { name: 'Revoking...' })).toBeDisabled();
  });
});

describe('useSchoolManagersData handlers', () => {
  it('run the server action without a native confirm and track the busy id', async () => {
    m.removeSchoolManager.mockResolvedValue({ success: true });
    m.revokeManagerInvite.mockResolvedValue({ success: false, error: 'nope' });
    const { result } = renderHook(() => useSchoolManagersData('s1', false));

    let removed: unknown;
    await act(async () => {
      removed = await result.current.handleRemoveManager('mgr-9');
    });
    expect(removed).toEqual({ success: true });
    expect(m.removeSchoolManager).toHaveBeenCalledWith({ managerId: 'mgr-9' });

    let revoked: unknown;
    await act(async () => {
      revoked = await result.current.handleRevokeInvite('inv-9');
    });
    expect(revoked).toEqual({ success: false, error: 'nope' });
    expect(m.revokeManagerInvite).toHaveBeenCalledWith('inv-9');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(result.current.isRemovingId).toBeNull();
    expect(result.current.isRevokingId).toBeNull();
  });
});
