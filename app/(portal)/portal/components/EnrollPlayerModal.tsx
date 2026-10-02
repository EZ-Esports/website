'use client';

import { Button } from 'react-aria-components';
import {
  HiOutlineUserPlus,
  HiOutlineXMark,
  HiOutlineExclamationTriangle,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import type {
  SchoolRosterDetails,
  SchoolPoolPlayer,
} from '@/app/lib/onboarding/portal-actions';

interface EnrollPlayerModalProps {
  roster: SchoolRosterDetails | null;
  playerPool: SchoolPoolPlayer[];
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  enrollRole: 'player' | 'sub' | 'captain';
  setEnrollRole: (role: 'player' | 'sub' | 'captain') => void;
  enrollCustomIgn: string;
  setEnrollCustomIgn: (ign: string) => void;
  enrollSearchQuery: string;
  setEnrollSearchQuery: (q: string) => void;
  enrollError: string | null;
  isEnrolling: boolean;
  onConfirmEnroll: () => void;
  onClose: () => void;
}

export function EnrollPlayerModal({
  roster,
  playerPool,
  selectedMemberId,
  setSelectedMemberId,
  enrollRole,
  setEnrollRole,
  enrollCustomIgn,
  setEnrollCustomIgn,
  enrollSearchQuery,
  setEnrollSearchQuery,
  enrollError,
  isEnrolling,
  onConfirmEnroll,
  onClose,
}: EnrollPlayerModalProps) {
  if (!roster) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-player-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-400/10 text-emerald-400">
              <HiOutlineUserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="enroll-player-modal-title" className="font-bold text-white text-base">
                Enroll Player to Roster
              </h3>
              <p className="text-xs text-zinc-400">
                {roster.name} &bull; {roster.gameName} (Div {roster.division})
              </p>
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

        {enrollError && (
          <div className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-center gap-2">
            <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
            <span>{enrollError}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Select Player from School Pool */}
          <div>
            <label
              htmlFor="enroll-player-pool-select"
              className="block text-xs font-semibold text-zinc-300 mb-1"
            >
              Select Player from School Pool
            </label>
            {playerPool.length > 5 && (
              <div className="relative mb-2">
                <HiOutlineMagnifyingGlass className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by student name or IGN..."
                  aria-label="Search by student name or IGN"
                  value={enrollSearchQuery}
                  onChange={(e) => setEnrollSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                />
              </div>
            )}

            <select
              id="enroll-player-pool-select"
              value={selectedMemberId}
              onChange={(e) => {
                const memberId = e.target.value;
                setSelectedMemberId(memberId);
                const selected = playerPool.find((p) => p.memberId === memberId);
                if (selected && selected.ign && selected.ign !== 'Unlinked') {
                  setEnrollCustomIgn(selected.ign);
                }
              }}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            >
              <option value="">-- Choose a student ({playerPool.length} available) --</option>
              {playerPool
                .filter((p) => {
                  if (!enrollSearchQuery.trim()) return true;
                  const q = enrollSearchQuery.toLowerCase();
                  return (
                    p.playerName.toLowerCase().includes(q) ||
                    p.ign.toLowerCase().includes(q) ||
                    p.discordUsername.toLowerCase().includes(q)
                  );
                })
                .map((p) => {
                  const isOnThisRoster = roster.players.some(
                    (rp) => rp.memberId === p.memberId
                  );
                  const currentEnrollment = p.enrolledRosters.find(
                    (er) => er.rosterId === roster.id
                  );
                  const otherEnrollment = p.enrolledRosters.find(
                    (er) => er.rosterId !== roster.id
                  );

                  const labelSuffix = isOnThisRoster
                    ? ` (Already on this roster: ${currentEnrollment?.role || 'enrolled'})`
                    : otherEnrollment
                    ? ` (Currently on ${otherEnrollment.rosterName})`
                    : '';

                  return (
                    <option
                      key={p.memberId}
                      value={p.memberId}
                      disabled={isOnThisRoster}
                    >
                      {p.playerName} — IGN: {p.ign} | Discord: {p.discordUsername}{labelSuffix}
                    </option>
                  );
                })}
            </select>

            {playerPool.length === 0 && (
              <p className="text-xs text-amber-400/80 mt-1">
                No approved players found in your school pool yet. Generate an invite link or approve pending onboarding applications first.
              </p>
            )}
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Roster Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEnrollRole('player')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                  enrollRole === 'player'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Starter
              </button>
              <button
                type="button"
                onClick={() => setEnrollRole('sub')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                  enrollRole === 'sub'
                    ? 'bg-zinc-800 border-zinc-500 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Substitute
              </button>
              <button
                type="button"
                onClick={() => setEnrollRole('captain')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                  enrollRole === 'captain'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ★ Captain
              </button>
            </div>
            {enrollRole === 'captain' &&
              roster.players.some((p) => p.isCaptain) && (
                <p className="text-[11px] text-amber-400/90 mt-1.5">
                  Note: This roster already has a captain (
                  {roster.players.find((p) => p.isCaptain)?.playerName}). Enrolling as captain will transfer captaincy to this player.
                </p>
              )}
          </div>

          {/* In-Game Name (IGN) */}
          <div>
            <label
              htmlFor="enroll-custom-ign"
              className="block text-xs font-semibold text-zinc-300 mb-1"
            >
              In-Game Name (IGN)
            </label>
            <input
              id="enroll-custom-ign"
              type="text"
              value={enrollCustomIgn}
              onChange={(e) => setEnrollCustomIgn(e.target.value)}
              placeholder="Auto-detected from Riot verification"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
            />
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
            Enrolling assigns this player to the official competition roster. Their Riot verification and Discord status will immediately count toward the 5-point tournament validation gate.
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
            onPress={onConfirmEnroll}
            isDisabled={isEnrolling || !selectedMemberId}
            className="px-4 py-2 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            {isEnrolling ? 'Enrolling...' : 'Confirm Enrollment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
