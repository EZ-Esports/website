// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  issuePasswordResetLink: vi.fn(),
  revokePasswordResetLink: vi.fn(),
  listPasswordResetLinks: vi.fn(),
}));
vi.mock('@/app/(admin)/admin/password-reset-actions', () => actions);

import PasswordResetDialog from '../PasswordResetDialog';

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  actions.listPasswordResetLinks.mockResolvedValue([]);
  actions.issuePasswordResetLink.mockResolvedValue({
    success: true,
    resetPath: '/reset-password?token=abc123',
    expiresAt: '2026-11-14T12:00:00.000Z',
  });
  writeText.mockResolvedValue(undefined);
});
afterEach(cleanup);

// user-event installs its own clipboard stub in setup(), so ours goes in afterwards.
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return user;
}

function open() {
  render(<PasswordResetDialog isOpen onOpenChange={() => undefined} userId="u1" subject="Alex Miller" />);
}

describe('PasswordResetDialog', () => {
  it('copies the absolute link as soon as it is generated and says so', async () => {
    const user = setupUser();
    open();
    await user.click(await screen.findByRole('button', { name: /generate reset link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/reset-password?token=abc123`);
    expect(await screen.findByText('Copied to clipboard.')).toBeTruthy();
    expect(actions.issuePasswordResetLink).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('shows a clear message and keeps the manual Copy button when auto-copy is blocked', async () => {
    writeText.mockRejectedValueOnce(new Error('blocked'));
    const user = setupUser();
    open();
    await user.click(await screen.findByRole('button', { name: /generate reset link/i }));
    expect(await screen.findByText(/Could not copy automatically/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /copy reset link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Copied to clipboard.')).toBeTruthy();
  });

  it('ignores a second click while a link is being issued', async () => {
    let resolveIssue!: (v: unknown) => void;
    actions.issuePasswordResetLink.mockReturnValue(new Promise((r) => (resolveIssue = r)));
    const user = setupUser();
    open();
    const button = await screen.findByRole('button', { name: /generate reset link/i });
    await user.click(button);
    await user.click(button);
    expect(actions.issuePasswordResetLink).toHaveBeenCalledTimes(1);
    resolveIssue({ success: false, error: 'no' });
  });
});
