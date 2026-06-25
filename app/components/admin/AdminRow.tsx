'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { revokeAdmin, updateUserRoles } from '@/app/(admin)/admin/team/actions';
import { parseHexColor } from '@/app/lib/roles';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineEllipsisVertical,
} from 'react-icons/hi2';

interface AdminRowProps {
  admin: {
    userId: string;
    email: string;
    roles: {
      id: string;
      name: string;
      color: string;
      position: number;
    }[];
    createdAt: Date;
  };
  isSelf: boolean;
  /** Whether the current actor is allowed to manage this admin user (hierarchy check passed). */
  canRevoke: boolean;
  assignableRoles: {
    id: string;
    name: string;
    color: string;
  }[];
}

export default function AdminRow({ admin, isSelf, canRevoke, assignableRoles }: AdminRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // Popover state managers
  const [rolesMenuOpen, setRolesMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const rolesRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rolesRef.current && !rolesRef.current.contains(event.target as Node)) {
        setRolesMenuOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (removed) return null;

  // Revoke member access
  function handleRevoke() {
    if (!window.confirm(`Remove admin access for ${admin.email}? They will be signed out immediately.`)) {
      return;
    }
    setActionsMenuOpen(false);
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

  // Toggle role assignment inline
  function handleToggleRole(roleId: string, hasRole: boolean) {
    setError(null);
    let newRoleIds: string[];
    if (hasRole) {
      newRoleIds = admin.roles.filter((r) => r.id !== roleId).map((r) => r.id);
    } else {
      newRoleIds = [...admin.roles.map((r) => r.id), roleId];
    }

    startTransition(async () => {
      const result = await updateUserRoles(admin.userId, newRoleIds);
      if (!result.success) {
        setError(result.error ?? 'Could not update roles.');
      }
    });
  }

  // Derive initials and colors
  const getInitials = (email: string) => {
    const parts = email.split('@')[0] || '';
    if (!parts) return 'S';
    return parts.slice(0, 2).toUpperCase();
  };

  const highestRole = admin.roles.reduce((highest, current) => {
    if (!highest) return current;
    return current.position > highest.position ? current : highest;
  }, null as typeof admin.roles[number] | null);

  const highestRoleColor = highestRole ? parseHexColor(highestRole.color) : '#94a3b8';

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-zinc-950/20 hover:bg-zinc-900/30 border border-zinc-800/80 rounded-xl transition-all gap-4 select-none ${
        isPending ? 'opacity-70' : ''
      }`}
    >
      {/* Left Column: Avatar & Name */}
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm border select-none shrink-0"
          style={{
            backgroundColor: `${highestRoleColor}12`,
            color: highestRoleColor,
            borderColor: `${highestRoleColor}25`,
          }}
        >
          {getInitials(admin.email)}
        </div>
        <div className="min-w-0">
          <span
            className="text-sm font-extrabold truncate block leading-snug"
            style={{ color: highestRoleColor }}
          >
            {admin.email}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            Joined {new Date(admin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
        </div>
      </div>

      {/* Center Column: Role Pill flex and inline role popover */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {admin.roles.map((role) => {
          const parsedColor = parseHexColor(role.color);
          return (
            <span
              key={role.id}
              className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider shrink-0"
              style={{
                backgroundColor: `${parsedColor}12`,
                color: parsedColor,
                border: `1px solid ${parsedColor}25`,
              }}
            >
              {role.name}
            </span>
          );
        })}

        {admin.roles.length === 0 && (
          <span className="text-zinc-600 italic text-xs px-1">No Roles</span>
        )}

        {/* Inline Role Assignment Popover, matching Discord */}
        {canRevoke && (
          <div className="relative inline-block" ref={rolesRef}>
            <button
              onClick={() => setRolesMenuOpen(!rolesMenuOpen)}
              className="p-1 hover:bg-zinc-800 rounded text-slate-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-zinc-800 ml-1"
              title="Add / Remove Roles"
            >
              <HiOutlinePlus className="w-3.5 h-3.5" />
            </button>

            {rolesMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl bg-zinc-950 border border-zinc-800 p-2 shadow-2xl z-50 space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-1 border-b border-zinc-900 mb-1 select-none">
                  Assign Roles
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  {assignableRoles.map((role) => {
                    const hasRole = admin.roles.some((r) => r.id === role.id);
                    const parsedColor = parseHexColor(role.color);
                    return (
                      <button
                        key={role.id}
                        disabled={isPending}
                        type="button"
                        onClick={() => handleToggleRole(role.id, hasRole)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-350 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer disabled:opacity-50 select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: parsedColor }} />
                          <span>{role.name}</span>
                        </div>
                        {hasRole && <span className="w-1.5 h-1.5 rounded-full bg-ez-pink" />}
                      </button>
                    );
                  })}
                  {assignableRoles.length === 0 && (
                    <div className="text-center py-2 text-[10px] text-zinc-600 italic">No roles assignable</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Actions Dropdown Menu */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {isSelf ? (
          <span className="text-xs text-zinc-600 italic px-3 select-none">You</span>
        ) : !canRevoke ? (
          <span className="text-xs text-zinc-600 italic px-3 select-none">—</span>
        ) : (
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
              className="p-2 bg-zinc-900/50 hover:bg-zinc-800 text-slate-400 hover:text-white rounded-lg border border-zinc-850 hover:border-zinc-700 transition-all cursor-pointer"
              title="More Actions"
            >
              <HiOutlineEllipsisVertical className="w-4 h-4" />
            </button>

            {actionsMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-950 border border-zinc-800 p-1.5 shadow-2xl z-50">
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                  <span>Remove Access</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
