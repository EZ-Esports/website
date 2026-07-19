'use client';

import { useState, useTransition } from 'react';
import { MenuTrigger, Popover, Menu, MenuItem, Button } from 'react-aria-components';
import type { Selection } from 'react-aria-components';
import { revokeStaff, updateUserRoles } from '@/app/(admin)/admin/team/actions';
import { parseHexColor } from '@/app/lib/roles';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineEllipsisVertical,
} from 'react-icons/hi2';

interface StaffRowProps {
  member: {
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
  /** Whether the current actor is allowed to manage this staff member (hierarchy check passed). */
  canRevoke: boolean;
  assignableRoles: {
    id: string;
    name: string;
    color: string;
  }[];
}

export default function StaffRow({ member, isSelf, canRevoke, assignableRoles }: StaffRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  // Controlled so a cancelled confirm keeps the menu open (RAC otherwise closes
  // the menu unconditionally after onAction runs).
  const [actionsOpen, setActionsOpen] = useState(false);

  if (removed) return null;

  // Revoke member access
  function handleRevoke() {
    if (!window.confirm(`Revoke staff access for ${member.email}? Their portal identity will be removed.`)) {
      return;
    }
    setActionsOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await revokeStaff(member.userId);
      if (!result.success) {
        setError(result.error ?? 'Could not revoke staff access.');
        return;
      }
      setRemoved(true);
    });
  }

  // Sync role assignment from the menu's full selection (RAC reports the resulting
  // set on every toggle, not just the changed key, so no manual add/remove diffing).
  function handleRolesChange(keys: Selection) {
    // RAC emits 'all' only when a "select all" gesture fires. This menu has no such
    // affordance, so this guard is purely defensive against unexpected RAC behavior changes.
    if (keys === 'all') {
      if (process.env.NODE_ENV !== 'production') throw new Error('Unexpected selectAll in roles menu');
      return;
    }
    setError(null);
    const newRoleIds = Array.from(keys, String);
    startTransition(async () => {
      const result = await updateUserRoles(member.userId, newRoleIds);
      if (!result.success) {
        setError(result.error ?? 'Could not update roles.');
      }
    });
  }

  // Derive initials and colors
  const getInitials = (email: string) => {
    const local = email.split('@')[0] ?? '';
    return local.slice(0, 2).toUpperCase() || '?';
  };

  const highestRole = member.roles.reduce((highest, current) => {
    if (!highest) return current;
    return current.position > highest.position ? current : highest;
  }, null as typeof member.roles[number] | null);

  const highestRoleColor = highestRole ? parseHexColor(highestRole.color) : '#94a3b8';
  const selectedRoleIds = new Set(member.roles.map((r) => r.id));

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface-sunken/20 hover:bg-surface-raised/30 border border-line/80 rounded-xl transition-all gap-4 select-none ${
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
          {getInitials(member.email)}
        </div>
        <div className="min-w-0">
          <span
            className="text-sm font-extrabold truncate block leading-snug"
            style={{ color: highestRoleColor }}
          >
            {member.email}
          </span>
          <span className="text-[10px] text-foreground-muted font-medium">
            Joined {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
        </div>
      </div>

      {/* Center Column: Role Pill flex and inline role popover */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {member.roles.map((role) => {
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

        {member.roles.length === 0 && (
          <span className="text-foreground-muted italic text-xs px-1">No Roles</span>
        )}

        {/* Inline Role Assignment Popover, matching Discord */}
        {canRevoke && (
          <MenuTrigger>
            <Button
              isDisabled={isPending}
              className="p-1 hover:bg-line rounded text-foreground-secondary hover:text-white transition-all cursor-pointer border border-transparent hover:border-line ml-1"
              aria-label="Add / Remove Roles"
            >
              <HiOutlinePlus className="w-3.5 h-3.5" />
            </Button>

            <Popover className="w-56">
              <div className="rounded-xl bg-surface-sunken border border-line p-2 shadow-2xl space-y-1">
                <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest px-2 py-1 border-b border-surface-raised mb-1 select-none">
                  Assign Roles
                </div>
                <Menu
                  className="max-h-48 overflow-y-auto space-y-0.5 pr-1 outline-none"
                  selectionMode="multiple"
                  shouldCloseOnSelect={false}
                  selectedKeys={selectedRoleIds}
                  onSelectionChange={handleRolesChange}
                  renderEmptyState={() => (
                    <div className="text-center py-2 text-[10px] text-foreground-muted italic">No roles assignable</div>
                  )}
                >
                  {assignableRoles.map((role) => {
                    const hasRole = selectedRoleIds.has(role.id);
                    const parsedColor = parseHexColor(role.color);
                    return (
                      <MenuItem
                        key={role.id}
                        id={role.id}
                        textValue={role.name}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-foreground-secondary hover:text-white hover:bg-surface-raised data-[focused]:text-white data-[focused]:bg-surface-raised transition-all cursor-pointer data-[disabled]:opacity-50 select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: parsedColor }} />
                          <span>{role.name}</span>
                        </div>
                        {hasRole && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </div>
            </Popover>
          </MenuTrigger>
        )}
      </div>

      {/* Right Column: Actions Dropdown Menu */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {isSelf ? (
          <span className="text-xs text-foreground-muted italic px-3 select-none">You</span>
        ) : !canRevoke ? (
          <span className="text-xs text-foreground-muted italic px-3 select-none">—</span>
        ) : (
          <MenuTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
            <Button
              className="p-2 bg-surface-raised/50 hover:bg-line text-foreground-secondary hover:text-white rounded-lg border border-line hover:border-line transition-all cursor-pointer"
              aria-label={`More actions for ${member.email}`}
            >
              <HiOutlineEllipsisVertical className="w-4 h-4" />
            </Button>

            <Popover className="w-48">
              <Menu className="rounded-xl bg-surface-sunken border border-line p-1.5 shadow-2xl outline-none">
                <MenuItem
                  id="remove"
                  textValue="Remove Access"
                  isDisabled={isPending}
                  shouldCloseOnSelect={false}
                  onAction={handleRevoke}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold text-foreground-secondary hover:text-red-400 hover:bg-red-950/20 data-[focused]:text-red-400 data-[focused]:bg-red-950/20 transition-all cursor-pointer data-[disabled]:opacity-50"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                  <span>Remove Access</span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      </div>
    </div>
  );
}
