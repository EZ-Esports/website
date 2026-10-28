// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
  getVerifiedDiscordForInvite: vi.fn(),
  onWake: null as null | ((m: { inviteId: string; status: 'connected' | 'error'; error?: string }) => void),
  unsubscribe: vi.fn(),
}));

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: mocks.submitPlayerOnboarding,
  saveOnboardingDraft: mocks.saveOnboardingDraft,
  getVerifiedDiscordForInvite: mocks.getVerifiedDiscordForInvite,
}));
vi.mock('@/app/lib/onboarding/discord-channel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/onboarding/discord-channel')>()),
  listenDiscordResult: (_inviteId: string, cb: typeof mocks.onWake) => {
    mocks.onWake = cb;
    return mocks.unsubscribe;
  },
}));

import PlayerOnboardingWizard from '../PlayerOnboardingWizard';
import type { InviteData } from '../types';

const invite = (role: 'player' | 'manager' = 'player'): InviteData => ({
  inviteId: 'invite-1',
  role,
  intendedFirstName: 'Sam',
  intendedLastName: 'Miller',
  schoolId: 's1',
  schoolName: 'Stuyvesant',
  schoolSlug: 'stuyvesant',
  gameId: null,
  gameName: role === 'manager' ? 'School Manager' : 'Valorant',
  gameSlug: role === 'manager' ? 'manager' : 'valorant',
  submissionDraft: null,
  expiresAt: new Date(),
});

let openSpy: ReturnType<typeof vi.fn>;
let assignSpy: ReturnType<typeof vi.fn>;
const fakePopup = () => ({ closed: false, close: vi.fn() }) as unknown as Window;

beforeEach(() => {
  mocks.onWake = null;
  mocks.unsubscribe.mockReset();
  mocks.saveOnboardingDraft.mockReset().mockResolvedValue({ success: true });
  mocks.getVerifiedDiscordForInvite.mockReset().mockResolvedValue(null);
  openSpy = vi.fn(() => fakePopup());
  vi.stubGlobal('open', openSpy);
  assignSpy = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign: assignSpy } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderAtDiscordStep(role: 'player' | 'manager' = 'player', discord: { username: string; inGuild: boolean } | null = null) {
  return render(
    <PlayerOnboardingWizard token="tok" inviteData={invite(role)} discord={discord} resumeAtDiscord />
  );
}

describe('Discord sign-in in a second tab', () => {
  it('opens /api/discord/start with popup=1 synchronously in the click and saves the draft without waiting', () => {
    let resolveSave: (v: unknown) => void = () => {};
    mocks.saveOnboardingDraft.mockReturnValue(new Promise((r) => (resolveSave = r)));
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));

    // Still pending save, yet the tab is already open.
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = String(openSpy.mock.calls[0][0]);
    expect(url).toContain('/api/discord/start?');
    expect(url).toContain('token=tok');
    expect(url).toContain('school=stuyvesant');
    expect(url).toContain('popup=1');
    expect(mocks.saveOnboardingDraft).toHaveBeenCalledTimes(1);
    expect(assignSpy).not.toHaveBeenCalled();
    expect(screen.getAllByText(/waiting for discord/i).length).toBeGreaterThan(0);
    resolveSave({ success: true });
  });

  it('falls back to the same-tab redirect, after saving, when the browser blocks the new tab', async () => {
    openSpy.mockReturnValue(null);
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await waitFor(() => expect(assignSpy).toHaveBeenCalledTimes(1));
    const url = String(assignSpy.mock.calls[0][0]);
    expect(url).toContain('/api/discord/start?');
    expect(url).not.toContain('popup=1');
    expect(mocks.saveOnboardingDraft).toHaveBeenCalledTimes(1);
  });

  it('refreshes the identity from the server (not the message) when the other tab reports success, without losing state', async () => {
    mocks.getVerifiedDiscordForInvite.mockResolvedValue({ username: 'from_cookie', inGuild: true });
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    expect(mocks.onWake).toBeTruthy();

    await act(async () => {
      // The message claims a different name; it must be ignored.
      mocks.onWake!({ inviteId: 'invite-1', status: 'connected' });
    });
    await waitFor(() => expect(screen.getByText(/@from_cookie/)).toBeInTheDocument());
    expect(mocks.getVerifiedDiscordForInvite).toHaveBeenCalledWith('tok');
    expect(screen.queryAllByText(/waiting for discord/i)).toHaveLength(0);
    expect(mocks.unsubscribe).toHaveBeenCalled();
    // Still on the Discord step: the wizard did not remount or advance.
    expect(screen.getByRole('heading', { name: /Step 2/ })).toBeInTheDocument();
  });

  it('shows the error text from the other tab and stops waiting', async () => {
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await act(async () => {
      mocks.onWake!({ inviteId: 'invite-1', status: 'error', error: 'You cancelled the Discord sign-in.' });
    });
    await waitFor(() => expect(screen.getByText('You cancelled the Discord sign-in.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /connect discord/i })).toBeInTheDocument();
  });

  it('stops waiting when the other tab is closed without finishing', async () => {
    vi.useFakeTimers();
    const popup = { closed: false } as { closed: boolean };
    openSpy.mockReturnValue(popup);
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    expect(screen.getAllByText(/waiting for discord/i).length).toBeGreaterThan(0);
    await act(async () => {
      // Let the "was it blocked?" check run while the tab is still open.
      await vi.advanceTimersByTimeAsync(1);
    });
    popup.closed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryAllByText(/waiting for discord/i)).toHaveLength(0);
    expect(screen.getByText(/Discord was not connected/i)).toBeInTheDocument();
  });

  it('"Use a different Discord account" opens the same second tab', () => {
    renderAtDiscordStep('player', { username: 'old_name', inGuild: true });
    fireEvent.click(screen.getByRole('button', { name: /use a different discord account/i }));
    expect(String(openSpy.mock.calls[0][0])).toContain('popup=1');
  });

  it('cleans up its listeners when the wizard unmounts mid-connection', () => {
    const view = renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });
});

const waitingText = () => screen.queryAllByText(/waiting for discord/i);
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('Discord second tab: edge cases', () => {
  it('a manager keeps their password, fields and content overrides across a Discord connect (no remount)', async () => {
    mocks.getVerifiedDiscordForInvite.mockResolvedValue({ username: 'coach_sam', inGuild: true });
    render(<PlayerOnboardingWizard token="tok" inviteData={invite('manager')} discord={null} />);

    fireEvent.change(screen.getByLabelText(/legal first name/i), { target: { value: 'Fuckface' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /this is actually my real information/i }));
    fireEvent.change(screen.getByLabelText(/manager email/i), { target: { value: 'sam@school.edu' } });
    fireEvent.change(screen.getByLabelText(/create portal account password/i), { target: { value: 'hunter2hunter2' } });
    fireEvent.change(screen.getByLabelText(/graduation year/i), { target: { value: '2027' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.click(await screen.findByRole('button', { name: /connect discord/i }));
    await act(async () => {
      mocks.onWake!({ inviteId: 'invite-1', status: 'connected' });
    });
    await waitFor(() => expect(screen.getByText(/@coach_sam/)).toBeInTheDocument());

    // Still the same wizard instance: go back and everything is as typed.
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByLabelText(/legal first name/i)).toHaveValue('Fuckface');
    expect(screen.getByLabelText(/create portal account password/i)).toHaveValue('hunter2hunter2');
    expect(screen.getByRole('checkbox', { name: /this is actually my real information/i })).toBeChecked();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('a second click while connecting does not open another tab', () => {
    renderAtDiscordStep();
    const button = screen.getByRole('button', { name: /connect discord/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(mocks.saveOnboardingDraft).toHaveBeenCalledTimes(1);
  });

  it('treats an already-closed window handle as a blocked pop-up and uses the same-tab fallback', async () => {
    openSpy.mockReturnValue({ closed: true, close: vi.fn() });
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await waitFor(() => expect(assignSpy).toHaveBeenCalledTimes(1));
    expect(String(assignSpy.mock.calls[0][0])).not.toContain('popup=1');
  });

  it('treats a window that closes right after opening as blocked', async () => {
    vi.useFakeTimers();
    const popup = { closed: false, close: vi.fn() };
    openSpy.mockReturnValue(popup);
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    popup.closed = true;
    await tick(5);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(String(assignSpy.mock.calls[0][0])).not.toContain('popup=1');
  });

  it('a focus re-check that finds a new identity completes the connection while the tab is still open', async () => {
    vi.useFakeTimers();
    mocks.getVerifiedDiscordForInvite.mockResolvedValue({ username: 'new_name', inGuild: true });
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await tick(1);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await tick(1);
    expect(screen.getByText(/@new_name/)).toBeInTheDocument();
    expect(waitingText()).toHaveLength(0);
  });

  it('a focus re-check that still sees the OLD identity neither ends the wait nor blanks the identity', async () => {
    vi.useFakeTimers();
    mocks.getVerifiedDiscordForInvite.mockResolvedValue({ username: 'old_name', inGuild: true });
    renderAtDiscordStep('player', { username: 'old_name', inGuild: true });
    fireEvent.click(screen.getByRole('button', { name: /use a different discord account/i }));
    await tick(1);
    // Waiting is shown even though an identity is already on screen.
    expect(waitingText().length).toBeGreaterThan(0);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await tick(1);
    expect(mocks.getVerifiedDiscordForInvite).toHaveBeenCalled();
    expect(waitingText().length).toBeGreaterThan(0);
    expect(screen.getByText(/@old_name/)).toBeInTheDocument();
  });

  it('a server answer of "no cookie" during a focus re-check does not blank the shown identity', async () => {
    vi.useFakeTimers();
    mocks.getVerifiedDiscordForInvite.mockResolvedValue(null);
    renderAtDiscordStep('player', { username: 'old_name', inGuild: true });
    fireEvent.click(screen.getByRole('button', { name: /use a different discord account/i }));
    await tick(1);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await tick(1);
    expect(screen.getByText(/@old_name/)).toBeInTheDocument();
  });

  it('runs one re-check at a time', async () => {
    vi.useFakeTimers();
    let release: (v: unknown) => void = () => {};
    mocks.getVerifiedDiscordForInvite.mockReturnValue(new Promise((r) => (release = r)));
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await tick(1);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
    });
    expect(mocks.getVerifiedDiscordForInvite).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
    });
  });

  it('the slow server poll picks up a result whose message was lost', async () => {
    vi.useFakeTimers();
    mocks.getVerifiedDiscordForInvite.mockResolvedValue({ username: 'late_name', inGuild: true });
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await tick(5200);
    expect(screen.getByText(/@late_name/)).toBeInTheDocument();
    expect(waitingText()).toHaveLength(0);
  });

  it('a closed tab with a successful cookie connects without an error', async () => {
    vi.useFakeTimers();
    const popup = { closed: false, close: vi.fn() };
    openSpy.mockReturnValue(popup);
    mocks.getVerifiedDiscordForInvite.mockResolvedValue({ username: 'done_name', inGuild: true });
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await tick(1);
    popup.closed = true;
    await tick(1000);
    expect(screen.getByText(/@done_name/)).toBeInTheDocument();
    expect(screen.queryByText(/Discord was not connected/i)).toBeNull();
  });

  it('gives up after ten minutes', async () => {
    vi.useFakeTimers();
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    await tick(1);
    expect(waitingText().length).toBeGreaterThan(0);
    await tick(10 * 60_000 + 10);
    expect(waitingText()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /connect discord/i })).toBeInTheDocument();
  });

  it('Cancel closes the tab we opened and stops waiting, so an expired sign-in cannot trap the person', async () => {
    const popup = { closed: false, close: vi.fn() };
    openSpy.mockReturnValue(popup);
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel and stop waiting/i }));
    expect(popup.close).toHaveBeenCalled();
    expect(waitingText()).toHaveLength(0);
    expect(mocks.unsubscribe).toHaveBeenCalled();
    // And they can try again.
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the waiting text inside the always-mounted status region', () => {
    renderAtDiscordStep();
    fireEvent.click(screen.getByRole('button', { name: /connect discord/i }));
    const note = screen.getByText(/Waiting for Discord in the other tab/i);
    expect(note.closest('[role="status"]')).not.toBeNull();
  });
});
