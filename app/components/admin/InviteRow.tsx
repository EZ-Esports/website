'use client';

import { useState, useTransition } from 'react';
import { MenuTrigger, Popover, Menu, MenuItem, Button } from 'react-aria-components';
import { revokeInvite } from '@/app/(admin)/admin/team/actions';
import { parseHexColor } from '@/app/lib/roles';
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
          {getInitials(invite.email)}
        </div>
        <div className="min-w-0">
          <span
            className="text-sm font-extrabold truncate block leading-snug"
            style={{ color: highestRoleColor }}
          >
            {invite.email}
          </span>
          <span className="text-[10px] text-foreground-muted font-medium">
            {expired ? (
              <span className="text-amber-400 font-bold uppercase tracking-wider">Expired</span>
            ) : (
              `Expires ${new Date(invite.expiresAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}`
            )}
          </span>
          {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
        </div>
      </div>

      {/* Center Column: Role Pill flex */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {invite.roles.map((role) => {
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

        {invite.roles.length === 0 && (
          <span className="text-foreground-muted italic text-xs px-1">No Roles</span>
        )}
      </div>

      {/* Right Column: Actions Dropdown Menu */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {!canRevoke ? (
          <span className="text-xs text-foreground-muted italic px-3 select-none">—</span>
        ) : (
          <MenuTrigger isOpen={actionsOpen} onOpenChange={setActionsOpen}>
            <Button
              className="p-2 bg-surface-raised/50 hover:bg-line text-foreground-secondary hover:text-white rounded-lg border border-line hover:border-line transition-all cursor-pointer"
              aria-label={`More actions for ${invite.email}`}
            >
              <HiOutlineEllipsisVertical className="w-4 h-4" />
            </Button>

            <Popover className="w-48">
              <Menu className="rounded-xl bg-surface-sunken border border-line p-1.5 shadow-2xl outline-none">
                <MenuItem
                  id="cancel"
                  textValue="Cancel Invite"
                  isDisabled={isPending}
                  shouldCloseOnSelect={false}
                  onAction={handleRevoke}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold text-foreground-secondary hover:text-red-400 hover:bg-red-950/20 data-[focused]:text-red-400 data-[focused]:bg-red-950/20 transition-all cursor-pointer data-[disabled]:opacity-50"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                  <span>Cancel Invite</span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      </div>
    </div>
  );
}
