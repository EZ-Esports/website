'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const WARN_THRESHOLD_S = 5 * 60; // 5 minutes in seconds
const CHECK_INTERVAL_MS = 30_000; // re-check every 30 seconds

export default function SessionWarning() {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.expires_at) { setSecsLeft(null); return; }
      const remaining = session.expires_at - Math.floor(Date.now() / 1000);
      setSecsLeft(remaining);
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (secsLeft === null || secsLeft > WARN_THRESHOLD_S) return null;

  const mins = Math.max(0, Math.ceil(secsLeft / 60));

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-amber-700/40 bg-amber-950/80 px-4 py-3 text-xs font-semibold text-amber-300 shadow-lg backdrop-blur"
    >
      <span>
        {secsLeft <= 0
          ? 'Your session has expired. Save your work and sign in again.'
          : `Session expires in ${mins} minute${mins !== 1 ? 's' : ''}. Unsaved changes may be lost.`}
      </span>
      {secsLeft > 0 && (
        <button
          type="button"
          aria-label="Refresh session"
          onClick={() => window.location.reload()}
          className="ml-1 cursor-pointer rounded-md border border-amber-700/40 bg-amber-900/40 px-2.5 py-1 hover:bg-amber-900/70 transition-colors"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
