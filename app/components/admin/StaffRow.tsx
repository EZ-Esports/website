'use client';

import { useState, useTransition } from 'react';
import { MenuTrigger, Popover, Menu, MenuItem, Button } from 'react-aria-components';
import type { Selection } from 'react-aria-components';
import { revokeStaff, updateUserRoles } from '@/app/(admin)/admin/team/actions';
import { parseHexColor } from '@/app/lib/roles';
import { cx } from '@/app/lib/cx';
import {
  HiCheck,
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
    <li
      aria-busy={isPending}
      className={cx(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-3.5 transition-[background-color,opacity] duration-150 hover:bg-surface-raised/50',
        isPending && 'opacity-60',
      )}
    >
      {/* Left Column: Avatar & Name */}
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs select-none shrink-0"
          style={{
            backgroundColor: `${highestRoleColor}1f`,
            color: highestRoleColor,
          }}
        >
          {getInitials(member.email)}
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block leading-snug">
            {member.email}
          </span>
          <span className="text-xs text-foreground-secondary">
            Joined {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {error && <p role="alert" aria-live="polite" className="admin-fade-in mt-1 text-xs font-medium text-danger-on-tint">{error}</p>}
        </div>
      </div>

      {/* Center Column: Role Pill flex and inline role popover */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {member.roles.map((role) => {
          const parsedColor = parseHexColor(role.color);
          return (
            <span
              key={role.id}
              className="inline-flex h-6 items-center rounded-md px-2 text-xs font-medium shrink-0"
              style={{
                backgroundColor: `${parsedColor}1a`,
                color: parsedColor,
              }}
            >
              {role.name}
            </span>
          );
        })}

        {member.roles.length === 0 && (
          <span className="text-foreground-secondary text-xs px-1">No roles</span>
        )}

        {/* Inline Role Assignment Popover, matching Discord */}
        {canRevoke && (
          <MenuTrigger>
            <Button
              isDisabled={isPending}
              className={({ isFocusVisible }) =>
                cx(
                  'ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted data-[pressed]:bg-surface-raised transition-colors duration-150 cursor-pointer outline-none data-[disabled]:opacity-50',
                  isFocusVisible && 'ring-2 ring-accent/60',
                )
              }
              aria-label="Add / Remove Roles"
            >
              <HiOutlinePlus aria-hidden className="w-3.5 h-3.5" />
            </Button>

            <Popover className="admin-popover w-56">
              <div className="rounded-xl bg-surface-raised p-1.5 shadow-2xl shadow-black/60 ring-1 ring-line/70 space-y-1">
                <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-foreground-secondary border-b border-line/60 mb-1 select-none">
                  Assign Roles
                </div>
                <Menu
                  className="max-h-48 overflow-y-auto space-y-0.5 pr-1 outline-none"
                  selectionMode="multiple"
                  shouldCloseOnSelect={false}
                  selectedKeys={selectedRoleIds}
                  onSelectionChange={handleRolesChange}
                  renderEmptyState={() => (
                    <div className="text-center py-2 text-xs text-foreground-secondary">No roles assignable</div>
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
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-sm text-foreground-secondary hover:text-foreground hover:bg-line/60 data-[focused]:text-foreground data-[focused]:bg-line/60 data-[selected]:text-foreground transition-colors cursor-pointer outline-none data-[disabled]:opacity-50 select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/30" style={{ backgroundColor: parsedColor }} />
                          <span>{role.name}</span>
                        </div>
                        {hasRole && <HiCheck aria-hidden className="w-4 h-4 text-accent" />}
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
          <span className="text-xs text-foreground-secondary px-3 select-none">You</span>
        ) : !canRevoke ? (
          <span className="text-xs text-foreground-secondary px-3 select-none">—</span>
        ) : (
          <MenuTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
            <Button
              className={({ isFocusVisible }) =>
                cx(
                  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-raised data-[pressed]:bg-surface-raised transition-colors duration-150 cursor-pointer outline-none',
                  isFocusVisible && 'ring-2 ring-accent/60',
                )
              }
              aria-label={`More actions for ${member.email}`}
            >
              <HiOutlineEllipsisVertical aria-hidden className="w-4 h-4" />
            </Button>

            <Popover className="admin-popover w-48">
              <Menu className="rounded-xl bg-surface-raised p-1 shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none">
                <MenuItem
                  id="remove"
                  textValue="Remove Access"
                  isDisabled={isPending}
                  shouldCloseOnSelect={false}
                  onAction={handleRevoke}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-foreground-secondary hover:text-red-300 hover:bg-red-950/30 data-[focused]:text-red-300 data-[focused]:bg-red-950/30 transition-colors cursor-pointer outline-none data-[disabled]:opacity-50"
                >
                  <HiOutlineTrash aria-hidden className="w-4 h-4" />
                  <span>Remove Access</span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      </div>
    </li>
  );
}
