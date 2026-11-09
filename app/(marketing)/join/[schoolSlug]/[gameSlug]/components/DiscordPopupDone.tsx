'use client';

import { useEffect } from 'react';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { broadcastDiscordResult } from '@/app/lib/onboarding/discord-channel';

interface DiscordPopupDoneProps {
  inviteId: string;
  status: 'connected' | 'error';
  /** Readable failure text, chosen on the server from a fixed list. */
  message?: string | null;
}

/**
 * What the second tab shows once Discord sign-in is over. It tells the wizard tab (which kept its
 * state, fields and password) to re-check the server, then tries to close itself. Scripts may only
 * close tabs they opened, so the visible instruction is the real fallback.
 */
export function DiscordPopupDone({ inviteId, status, message }: DiscordPopupDoneProps) {
  useEffect(() => {
    broadcastDiscordResult({ inviteId, status, ...(status === 'error' && message ? { error: message } : {}) });
    const timer = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // The visible instruction below covers a tab that cannot close itself.
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [inviteId, status, message]);

  const ok = status === 'connected';
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-surface-elevated border border-border rounded-2xl p-8 text-center space-y-4 shadow-lg">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
            ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger-on-tint'
          }`}
        >
          {ok ? <FiCheckCircle className="w-7 h-7" aria-hidden="true" /> : <FiAlertTriangle className="w-7 h-7" aria-hidden="true" />}
        </div>
        <div role="status" className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">{ok ? 'Discord connected' : 'Discord was not connected'}</h1>
          <p className="text-sm text-foreground-muted leading-relaxed">
            {ok
              ? 'You can close this tab and return to your form. Nothing you entered there has been lost.'
              : `${message ?? 'Something went wrong.'} You can close this tab and try again from your form.`}
          </p>
        </div>
      </div>
    </main>
  );
}
