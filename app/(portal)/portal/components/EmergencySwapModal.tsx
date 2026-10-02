'use client';

import { Button } from 'react-aria-components';
import { HiOutlineArrowsRightLeft, HiOutlineXMark } from 'react-icons/hi2';
import type { SchoolRosterDetails } from '@/app/lib/onboarding/portal-actions';

interface EmergencySwapModalProps {
  roster: SchoolRosterDetails | null;
  outPlayerId: string;
  setOutPlayerId: (id: string) => void;
  inPlayerId: string;
  setInPlayerId: (id: string) => void;
  swapError: string | null;
  isSwapping: boolean;
  onConfirmSwap: () => void;
  onClose: () => void;
}

export function EmergencySwapModal({
  roster,
  outPlayerId,
  setOutPlayerId,
  inPlayerId,
  setInPlayerId,
  swapError,
  isSwapping,
  onConfirmSwap,
  onClose,
}: EmergencySwapModalProps) {
  if (!roster) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-swap-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400">
              <HiOutlineArrowsRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 id="emergency-swap-modal-title" className="font-bold text-white text-base">
                Match-Day Emergency Sub
              </h3>
              <p className="text-xs text-zinc-400">{roster.name}</p>
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

        {swapError && (
          <div className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg">
            {swapError}
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="swap-out-player-select"
              className="block text-xs font-semibold text-zinc-300 mb-1"
            >
              Starter / Captain to Bench (Swap Out)
            </label>
            <select
              id="swap-out-player-select"
              value={outPlayerId}
              onChange={(e) => setOutPlayerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            >
              {roster.players
                .filter((p) => p.role === 'player' || p.role === 'captain' || p.isCaptain)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.playerName} ({p.ign}) {p.isCaptain ? '★ Captain' : 'Starter'}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="swap-in-player-select"
              className="block text-xs font-semibold text-zinc-300 mb-1"
            >
              Substitute to Activate (Swap In)
            </label>
            <select
              id="swap-in-player-select"
              value={inPlayerId}
              onChange={(e) => setInPlayerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            >
              {roster.players
                .filter((p) => p.role === 'sub')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.playerName} ({p.ign})
                  </option>
                ))}
            </select>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
            Swapping updates the active starting lineup immediately in the database and audit trail. The swap will be broadcast to referee operations.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            onPress={onClose}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onPress={onConfirmSwap}
            isDisabled={isSwapping}
            className="px-4 py-2 text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isSwapping ? 'Swapping...' : 'Confirm Emergency Swap'}
          </Button>
        </div>
      </div>
    </div>
  );
}
