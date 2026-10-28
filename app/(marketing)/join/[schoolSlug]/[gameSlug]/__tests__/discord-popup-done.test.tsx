// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiscordPopupDone } from '../components/DiscordPopupDone';
import { broadcastDiscordResult, listenDiscordResult } from '@/app/lib/onboarding/discord-channel';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DiscordPopupDone', () => {
  it('tells the person to close the tab and returns to the form, then tries to close itself', () => {
    vi.useFakeTimers();
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    const received: unknown[] = [];
    const stop = listenDiscordResult('inv-1', (m) => received.push(m));
    render(<DiscordPopupDone inviteId="inv-1" status="connected" />);
    expect(screen.getByRole('heading', { name: /discord connected/i })).toBeInTheDocument();
    expect(screen.getByText(/close this tab and return to your form/i)).toBeInTheDocument();
    vi.advanceTimersByTime(700);
    expect(close).toHaveBeenCalled();
    stop();
  });

  it('shows the readable failure text', () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DiscordPopupDone inviteId="inv-1" status="error" message="You cancelled the Discord sign-in." />);
    expect(screen.getByRole('heading', { name: /not connected/i })).toBeInTheDocument();
    expect(screen.getByText(/You cancelled the Discord sign-in\./)).toBeInTheDocument();
  });

  it('survives window.close throwing', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'close').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<DiscordPopupDone inviteId="inv-1" status="connected" />);
    expect(() => vi.advanceTimersByTime(700)).not.toThrow();
  });
});

describe('discord-channel', () => {
  it('delivers a broadcast only to listeners of the same invite, via BroadcastChannel when it exists', async () => {
    if (typeof BroadcastChannel === 'undefined') return;
    const mine: unknown[] = [];
    const other: unknown[] = [];
    const stopMine = listenDiscordResult('inv-1', (m) => mine.push(m));
    const stopOther = listenDiscordResult('inv-2', (m) => other.push(m));
    broadcastDiscordResult({ inviteId: 'inv-1', status: 'error', error: 'nope' });
    await new Promise((r) => setTimeout(r, 50));
    expect(mine).toEqual([{ inviteId: 'inv-1', status: 'error', error: 'nope' }]);
    expect(other).toEqual([]);
    stopMine();
    stopOther();
  });

  it('falls back to storage events when BroadcastChannel is unavailable, and ignores junk', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const got: unknown[] = [];
    const stop = listenDiscordResult('inv-1', (m) => got.push(m));
    const fire = (newValue: string | null, key = 'ez-discord-oauth-result') =>
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
    fire(JSON.stringify({ inviteId: 'inv-1', status: 'connected', at: 1 }));
    fire(JSON.stringify({ inviteId: 'inv-2', status: 'connected' }));
    fire(JSON.stringify({ inviteId: 'inv-1', status: 'bogus' }));
    fire('not json');
    fire(null);
    fire(JSON.stringify({ inviteId: 'inv-1', status: 'connected' }), 'other-key');
    expect(got).toHaveLength(1);
    stop();
    fire(JSON.stringify({ inviteId: 'inv-1', status: 'connected' }));
    expect(got).toHaveLength(1);
  });

  it('never throws when channels and storage are blocked', () => {
    vi.stubGlobal('BroadcastChannel', function () {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => broadcastDiscordResult({ inviteId: 'inv-1', status: 'connected' })).not.toThrow();
    expect(() => listenDiscordResult('inv-1', () => {})()).not.toThrow();
  });
});
