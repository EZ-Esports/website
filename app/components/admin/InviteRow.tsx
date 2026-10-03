'use client';

import { useState, useTransition } from 'react';
import { MenuTrigger, Popover, Menu, MenuItem, Button } from 'react-aria-components';
import { revokeInvite } from '@/app/(admin)/admin/team/actions';
import { parseHexColor } from '@/app/lib/roles';
import { cx } from '@/app/lib/cx';
import { HiOutlineTrash, HiOutlineEllipsisVertical } from 'react-icons/hi2';

interface InviteRowProps {
  invite: {
    id: string;
    email: string;
    roles: {
      id: string;
      name: string;
      color: string;
      position?: number;
    }[];
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
  // Controlled so a cancelled confirm keeps the menu open (RAC otherwise closes
  // the menu unconditionally after onAction runs).
  const [actionsOpen, setActionsOpen] = useState(false);

  if (removed) return null;

  function handleRevoke() {
    if (!window.confirm(`Cancel the pending invite for ${invite.email}? The link will stop working.`)) {
      return;
    }
    setActionsOpen(false);
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

  // Derive initials and colors
  const getInitials = (email: string) => {
    const local = email.split('@')[0] ?? '';
    return local.slice(0, 2).toUpperCase() || '?';
  };

  const highestRole = invite.roles.reduce((highest, current) => {
    if (!highest) return current;
    const currentPos = current.position ?? 0;
    const highestPos = highest.position ?? 0;
    return currentPos > highestPos ? current : highest;
  }, null as typeof invite.roles[number] | null);

  const highestRoleColor = highestRole ? parseHexColor(highestRole.color) : '#94a3b8';

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
          {getInitials(invite.email)}
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block leading-snug">
            {invite.email}
          </span>
          <span className="text-xs text-foreground-secondary">
            {expired ? (
              <span className="font-medium text-warning">Expired</span>
            ) : (
              `Expires ${new Date(invite.expiresAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}`
            )}
          </span>
          {error && <p role="alert" aria-live="polite" className="admin-fade-in mt-1 text-xs font-medium text-danger-on-tint">{error}</p>}
        </div>
      </div>

      {/* Center Column: Role Pill flex */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {invite.roles.map((role) => {
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

        {invite.roles.length === 0 && (
          <span className="text-foreground-secondary text-xs px-1">No roles</span>
        )}
      </div>

      {/* Right Column: Actions Dropdown Menu */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {!canRevoke ? (
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
              aria-label={`More actions for ${invite.email}`}
            >
              <HiOutlineEllipsisVertical aria-hidden className="w-4 h-4" />
            </Button>

            <Popover className="admin-popover w-48">
              <Menu className="rounded-xl bg-surface-raised p-1 shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none">
                <MenuItem
                  id="cancel"
                  textValue="Cancel Invite"
                  isDisabled={isPending}
                  shouldCloseOnSelect={false}
                  onAction={handleRevoke}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-foreground-secondary hover:text-red-300 hover:bg-red-950/30 data-[focused]:text-red-300 data-[focused]:bg-red-950/30 transition-colors cursor-pointer outline-none data-[disabled]:opacity-50"
                >
                  <HiOutlineTrash aria-hidden className="w-4 h-4" />
                  <span>Cancel Invite</span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      </div>
    </li>
  );
}
