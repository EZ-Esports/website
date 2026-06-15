'use client';

import { useEffect } from 'react';
import { HiExclamationTriangle } from 'react-icons/hi2';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Admin Error]', error);
  }, [error]);

  return (
    <div className="p-8">
      <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-8 max-w-xl">
        <div className="flex items-start gap-4">
          <HiExclamationTriangle className="w-7 h-7 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="text-lg font-black text-red-400 tracking-tight">Something went wrong</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {error.message || 'An unexpected error occurred loading this page.'}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-600 font-mono">Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="mt-4 px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
