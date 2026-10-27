// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const resync = vi.hoisted(() => vi.fn());
vi.mock('@/app/(admin)/admin/schools/[schoolId]/rosters/discord-actions', () => ({ resyncDiscordRoles: resync }));

import ResyncDiscordRoles, { summarizeReport } from '../ResyncDiscordRoles';

afterEach(() => {
  cleanup();
  resync.mockReset();
});

const base = { status: 'ok' as const, synced: 0, unchanged: 0, skippedNoDiscord: 0, notInGuild: 0, failed: 0, failures: [] };

describe('ResyncDiscordRoles', () => {
  it('asks for confirmation in the in-app dialog and does nothing on cancel', async () => {
    const user = userEvent.setup();
    render(<ResyncDiscordRoles schoolId="s1" schoolName="Lincoln High" />);
    await user.click(screen.getByRole('button', { name: /resync discord roles/i }));
    expect(await screen.findByRole('alertdialog', { name: 'Resync Discord roles?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(resync).not.toHaveBeenCalled();
  });

  it('runs the action on confirm and shows the report with masked failures', async () => {
    resync.mockResolvedValue({
      success: true,
      report: { ...base, synced: 3, unchanged: 4, notInGuild: 1, failed: 1, failures: [{ member: 'abcd1234...', reason: 'bot_misconfigured' }] },
    });
    const user = userEvent.setup();
    render(<ResyncDiscordRoles schoolId="s1" schoolName="Lincoln High" />);
    await user.click(screen.getByRole('button', { name: /resync discord roles/i }));
    await user.click(await screen.findByRole('button', { name: 'Resync roles' }));
    const status = await screen.findByRole('status');
    expect(resync).toHaveBeenCalledWith('s1');
    expect(status).toHaveTextContent('3 updated, 4 already correct, 1 not in the Discord server, 1 failed');
    expect(status).toHaveTextContent('Member abcd1234...');
    expect(status).toHaveTextContent('Manage Roles');
  });

  it('keeps the dialog open with the error when the action returns one', async () => {
    resync.mockResolvedValue({ success: false, error: 'Discord tier role sync is not turned on.' });
    const user = userEvent.setup();
    render(<ResyncDiscordRoles schoolId="s1" schoolName="Lincoln High" />);
    await user.click(screen.getByRole('button', { name: /resync discord roles/i }));
    await user.click(await screen.findByRole('button', { name: 'Resync roles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not turned on');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('summarizeReport', () => {
  it('omits zero optional counts', () => {
    expect(summarizeReport({ ...base, synced: 1, unchanged: 2 })).toBe('Discord roles resynced: 1 updated, 2 already correct.');
  });
});
