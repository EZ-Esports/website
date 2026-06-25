'use client';

import { useState, useTransition } from 'react';
import { revokeAdmin } from '@/app/(admin)/admin/team/actions';
import { parseHexColor } from '@/app/lib/roles';

interface AdminRowProps {
  admin: {
    userId: string;
    email: string;
    roles: {
      id: string;
      name: string;
      color: string;
    }[];
    createdAt: Date;
  };
  isSelf: boolean;
  /** Whether the current actor is allowed to manage this admin user (hierarchy check passed). */
  canRevoke: boolean;
  onEditRoles: (userId: string, email: string, currentRoleIds: string[]) => void;
}

export default function AdminRow({ admin, isSelf, canRevoke, onEditRoles }: AdminRowProps) {
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
        <div className="flex flex-wrap gap-1.5">
          {admin.roles.map((role) => {
            const parsedColor = parseHexColor(role.color);
            return (
              <span
                key={role.id}
                className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider"
                style={{
                  backgroundColor: `${parsedColor}12`,
                  color: parsedColor,
                  border: `1px solid ${parsedColor}25`
                }}
              >
                {role.name}
              </span>
            );
          })}
          {admin.roles.length === 0 && (
            <span className="text-zinc-600 italic text-xs">No Roles</span>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
        {new Date(admin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="py-3">
        {isSelf ? (
          <span className="text-xs text-zinc-600 italic">You</span>
        ) : !canRevoke ? (
          <span className="text-xs text-zinc-600 italic">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditRoles(admin.userId, admin.email, admin.roles.map((r) => r.id))}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              Edit Roles
            </button>
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

