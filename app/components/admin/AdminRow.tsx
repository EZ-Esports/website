'use client';

import { useState, useTransition } from 'react';
import { revokeAdmin } from '@/app/(admin)/admin/team/actions';
import type { AdminRole } from '@/app/lib/roles';

interface AdminRowProps {
  admin: {
    userId: string;
    email: string;
    role: AdminRole;
    createdAt: Date;
  };
  isSelf: boolean;
}

const roleBadge: Record<AdminRole, string> = {
  admin: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  super_admin: 'bg-ez-pink/10 text-ez-pink border border-ez-pink/30',
};

export default function AdminRow({ admin, isSelf }: AdminRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  function handleRevoke() {
    if (!window.confirm(`Remove admin access for ${admin.email}? They will be signed out immediately.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revokeAdmin(admin.userId);
      if (!result.success) {
        setError(result.error ?? 'Could not remove admin.');
        return;
      }
      setRemoved(true);
    });
  }

  return (
    <tr className="hover:bg-zinc-900/40 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{admin.email}</td>
      <td className="py-3 pr-4">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${roleBadge[admin.role]}`}>
          {admin.role.replace('_', '-')}
        </span>
      </td>
      <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
        {new Date(admin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="py-3">
        {isSelf ? (
          <span className="text-xs text-zinc-600 italic">You</span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevoke}
              disabled={isPending}
              className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isPending ? 'Removing…' : 'Remove'}
            </button>
            {error && <span className="text-[10px] text-red-400">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
