'use client';

import { useState, useTransition } from 'react';
import { revokeInvite } from '@/app/(admin)/admin/team/actions';
import type { AdminRole } from '@/app/lib/roles';

interface InviteRowProps {
  invite: {
    id: string;
    email: string;
    role: AdminRole;
    expiresAt: Date;
  };
  expired: boolean;
  /** Whether the current actor is allowed to cancel this invite (server still enforces). */
  canRevoke: boolean;
}

export default function InviteRow({ invite, expired, canRevoke }: InviteRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  function handleRevoke() {
    if (!window.confirm(`Cancel the pending invite for ${invite.email}? The link will stop working.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revokeInvite(invite.id);
      if (!result.success) {
        setError(result.error ?? 'Could not cancel invite.');
        return;
      }
      setRemoved(true);
    });
  }

  return (
    <tr className="hover:bg-zinc-900/40 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{invite.email}</td>
      <td className="py-3 pr-4 text-slate-300 capitalize">{invite.role.replace('_', '-')}</td>
      <td className="py-3 pr-4 whitespace-nowrap">
        {expired ? (
          <span className="text-amber-400 text-xs font-semibold">Expired</span>
        ) : (
          <span className="text-slate-400">
            {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </td>
      <td className="py-3">
        {!canRevoke ? (
          <span className="text-xs text-zinc-600 italic">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevoke}
              disabled={isPending}
              className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isPending ? 'Cancelling…' : 'Cancel'}
            </button>
            {error && <span className="text-[10px] text-red-400">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
