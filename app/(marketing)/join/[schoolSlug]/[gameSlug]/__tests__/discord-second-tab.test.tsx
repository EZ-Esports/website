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
    popup.closed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryAllByText(/waiting for discord/i)).toHaveLength(0));
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
