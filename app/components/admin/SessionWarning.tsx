'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { HiOutlineClock } from 'react-icons/hi2';
import { secondaryBtnSm } from '@/app/components/admin/styles';

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

  // Bottom-left of the content area (just right of the 16rem sidebar), so it
  // never stacks on top of the bottom-right save toasts.
  return (
    <div
      role="alert"
      className="admin-toast fixed bottom-6 left-[17.5rem] z-50 flex max-w-md items-center gap-3 rounded-xl bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50 ring-1 ring-warning/30"
    >
      <HiOutlineClock aria-hidden className="h-5 w-5 shrink-0 text-warning" />
      <span className="leading-6 text-foreground">
        {secsLeft <= 0
          ? 'Your session has expired. Save your work and sign in again.'
          : `Session expires in ${mins} minute${mins !== 1 ? 's' : ''}. Unsaved changes may be lost.`}
      </span>
      {secsLeft > 0 && (
        <button
          type="button"
          aria-label="Refresh session"
          onClick={() => window.location.reload()}
          className={secondaryBtnSm}
        >
          Refresh
        </button>
      )}
    </div>
  );
}
