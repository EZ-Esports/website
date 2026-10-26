'use client';

import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { HiOutlineArrowUturnRight } from 'react-icons/hi2';

interface MovePlayerControlProps {
  playerName: string;
  /** The roster the player is on now. */
  rosterName: string;
  /** The team's other rosters. */
  siblings: Array<{ id: string; name: string }>;
  isDisabled: boolean;
  onMove: (toRosterId: string) => void;
}

const buttonClass =
  'min-h-[44px] sm:min-h-0 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Moves a player to another roster of the same team (a student is on one tier per game). One
 * sibling is a plain "Move to JV" button; more than one is a React Aria menu of the roster names.
 * The accessible name starts with the visible text (label in name) and then adds whose row it is,
 * because every row on the page has the same visible label.
 */
export function MovePlayerControl({ playerName, rosterName, siblings, isDisabled, onMove }: MovePlayerControlProps) {
  if (siblings.length === 0) return null;
  const context = `${playerName} (currently ${rosterName})`;

  if (siblings.length === 1) {
    const [target] = siblings;
    return (
      <Button
        onPress={() => onMove(target.id)}
        isDisabled={isDisabled}
        aria-label={`Move to ${target.name}: ${context}`}
        className={buttonClass}
      >
        <HiOutlineArrowUturnRight className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
        <span>Move to {target.name}</span>
      </Button>
    );
  }

  return (
    <MenuTrigger>
      <Button isDisabled={isDisabled} aria-label={`Move to…: ${context}`} className={buttonClass}>
        <HiOutlineArrowUturnRight className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
        <span>Move to…</span>
      </Button>
      <Popover placement="bottom end">
        <Menu
          aria-label={`Move ${context} to`}
          onAction={(key) => onMove(String(key))}
          className="min-w-32 rounded-xl border border-zinc-700 bg-zinc-900 p-1 text-xs shadow-2xl outline-none"
        >
          {siblings.map((r) => (
            <MenuItem
              key={r.id}
              id={r.id}
              textValue={r.name}
              className="flex min-h-[44px] sm:min-h-0 cursor-pointer items-center rounded-lg px-3 py-2 font-semibold text-zinc-200 outline-none data-[focused]:bg-zinc-800"
            >
              {r.name}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
