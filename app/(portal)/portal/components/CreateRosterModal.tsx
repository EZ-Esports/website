'use client';

import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import {
  HiOutlineUserGroup,
  HiOutlineXMark,
  HiOutlineExclamationTriangle,
  HiOutlinePlus,
} from 'react-icons/hi2';
import type { GameItem } from './GameTabs';

interface CreateRosterModalProps {
  isOpen: boolean;
  schoolName: string;
  games: GameItem[];
  defaultGameId?: string;
  isCreating: boolean;
  createError: string | null;
  onConfirmCreate: (data: { gameId: string; name: string; division: string }) => void;
  onClose: () => void;
}

const PRESET_NAMES = ['Varsity', 'Junior Varsity', 'Academy', 'Team Alpha'];

function CreateRosterModalContent({
  schoolName,
  games,
  initialGameId,
  isCreating,
  createError,
  onConfirmCreate,
  onClose,
}: {
  schoolName: string;
  games: GameItem[];
  initialGameId: string;
  isCreating: boolean;
  createError: string | null;
  onConfirmCreate: (data: { gameId: string; name: string; division: string }) => void;
  onClose: () => void;
}) {
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId);
  const [rosterName, setRosterName] = useState('Varsity');
  const [division, setDivision] = useState('A');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rosterName.trim();
    if (!trimmed) {
      setLocalError('Please enter a roster name.');
      return;
    }
    if (!selectedGameId) {
      setLocalError('Please select a game.');
      return;
    }
    setLocalError(null);
    onConfirmCreate({
      gameId: selectedGameId,
      name: trimmed,
      division,
    });
  };

  const activeError = createError || localError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-roster-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-400/10 text-emerald-400">
              <HiOutlineUserGroup className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-roster-modal-title" className="font-bold text-white text-base">
                Create Team Roster
              </h3>
              <p className="text-xs text-zinc-400">{schoolName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-1 rounded-lg"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Error notice */}
        {activeError && (
          <div className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-center gap-2">
            <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
            <span>{activeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Game Selection */}
          <div>
            <label
              htmlFor="create-roster-game"
              className="block text-xs font-semibold text-zinc-300 mb-1"
            >
              Competition Game
            </label>
            <select
              id="create-roster-game"
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Roster Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="create-roster-name"
                className="block text-xs font-semibold text-zinc-300"
              >
                Roster Name
              </label>
              <div className="flex items-center gap-1">
                {PRESET_NAMES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRosterName(preset)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="create-roster-name"
              type="text"
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
              placeholder="e.g. Varsity, Junior Varsity"
              maxLength={50}
              required
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            />
          </div>

          {/* Division */}
          <div>
            <label
              htmlFor="create-roster-division"
              className="block text-xs font-semibold text-zinc-300 mb-1"
            >
              Division
            </label>
            <select
              id="create-roster-division"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            >
              <option value="A">Division A (Premier / Varsity)</option>
              <option value="B">Division B (Junior Varsity / Challenger)</option>
              <option value="Open">Open Division</option>
            </select>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
            Creating a roster unlocks direct player enrollment and live 5-point eligibility verification for tournament registration.
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              onPress={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={isCreating || !rosterName.trim()}
              className="px-4 py-2 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>{isCreating ? 'Creating Roster...' : 'Create Roster'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateRosterModal(props: CreateRosterModalProps) {
  if (!props.isOpen) return null;

  const initialGameId =
    props.defaultGameId && props.defaultGameId !== 'all'
      ? props.defaultGameId
      : props.games[0]?.id || '';

  return (
    <CreateRosterModalContent
      key={initialGameId}
      schoolName={props.schoolName}
      games={props.games}
      initialGameId={initialGameId}
      isCreating={props.isCreating}
      createError={props.createError}
      onConfirmCreate={props.onConfirmCreate}
      onClose={props.onClose}
    />
  );
}
