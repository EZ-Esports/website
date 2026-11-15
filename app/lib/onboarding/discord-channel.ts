/**
 * Same-browser wake-up between the Discord sign-in tab and the wizard tab (client-side only).
 *
 * The message carries no identity: it says "the second tab finished" plus, on failure, the readable
 * text the page already showed. The wizard answers it by asking the server (`getVerifiedDiscordForInvite`),
 * which reads the signed httpOnly cookie, so a forged message can at most trigger a harmless re-check
 * or show some error text in the sender's own browser.
 *
 * BroadcastChannel is used where it exists; a `localStorage` write (which fires the `storage` event in
 * other tabs) is the fallback. Every browser API call is guarded because storage and channels can be
 * blocked (private windows, embedded browsers).
 */

export const DISCORD_CHANNEL_NAME = 'ez-discord-oauth';
const STORAGE_KEY = 'ez-discord-oauth-result';

export interface DiscordWakeUp {
  /** Invite the result belongs to, so another invite open in the same browser ignores it. */
  inviteId: string;
  status: 'connected' | 'error';
  /** Display text only, for the error case. */
  error?: string;
}

function isWakeUp(value: unknown): value is DiscordWakeUp {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.inviteId === 'string' &&
    (v.status === 'connected' || v.status === 'error') &&
    (v.error === undefined || typeof v.error === 'string')
  );
}

export function broadcastDiscordResult(message: DiscordWakeUp): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(DISCORD_CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    // Fall through to the storage path.
  }
  try {
    // A fresh timestamp makes every write a change, so the `storage` event always fires.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...message, at: Date.now() }));
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the wizard also re-checks when the tab closes or regains focus.
  }
}

/** Calls `onMessage` for results addressed to `inviteId`. Returns an unsubscribe function. */
export function listenDiscordResult(inviteId: string, onMessage: (message: DiscordWakeUp) => void): () => void {
  const deliver = (value: unknown) => {
    if (isWakeUp(value) && value.inviteId === inviteId) onMessage(value);
  };

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(DISCORD_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent) => deliver(event.data);
    }
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed values.
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('storage', onStorage);
    try {
      channel?.close();
    } catch {
      // Already closed.
    }
  };
}
