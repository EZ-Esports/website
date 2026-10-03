'use client';

import { Button } from 'react-aria-components';
import {
  HiOutlineUserPlus,
  HiOutlineArrowsRightLeft,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle,
  HiOutlineTrash,
} from 'react-icons/hi2';
import type {
  SchoolRosterDetails,
  RosterEligibilityResult,
} from '@/app/lib/onboarding/portal-actions';

interface RosterCardProps {
  roster: SchoolRosterDetails;
  gateResult?: RosterEligibilityResult;
  isEvaluating: boolean;
  onOpenEnrollModal: (roster: SchoolRosterDetails) => void;
  onOpenSwapModal: (roster: SchoolRosterDetails) => void;
  onCheckRosterGate: (rosterId: string) => void;
  onUpdateRole: (
    rosterId: string,
    playerId: string,
    role: 'player' | 'sub' | 'captain'
  ) => void;
  onRemovePlayer: (rosterId: string, playerId: string) => void;
  onDeleteRoster?: (rosterId: string) => void;
}

export function RosterCard({
  roster,
  gateResult,
  isEvaluating,
  onOpenEnrollModal,
  onOpenSwapModal,
  onCheckRosterGate,
  onUpdateRole,
  onRemovePlayer,
  onDeleteRoster,
}: RosterCardProps) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">{roster.name}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {roster.gameName} &bull; Division {roster.division}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {roster.players.length} Competitors Enrolled
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onPress={() => onOpenEnrollModal(roster)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <HiOutlineUserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enroll Player</span>
          </Button>
          <Button
            onPress={() => onOpenSwapModal(roster)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <HiOutlineArrowsRightLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Emergency Sub</span>
          </Button>
          <Button
            onPress={() => onCheckRosterGate(roster.id)}
            isDisabled={isEvaluating}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#f4cccc] hover:bg-[#e6b8b8] text-zinc-950 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isEvaluating ? 'Evaluating...' : 'Run Roster Gate'}
          </Button>
          {roster.players.length === 0 && onDeleteRoster && (
            <Button
              onPress={() => onDeleteRoster(roster.id)}
              aria-label="Delete empty roster"
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-900/50"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800/80">
              <th className="pb-2 font-semibold">Player</th>
              <th className="pb-2 font-semibold">Role</th>
              <th className="pb-2 font-semibold">In-Game Name</th>
              <th className="pb-2 font-semibold">Discord</th>
              <th className="pb-2 font-semibold">Server</th>
              <th className="pb-2 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {roster.players.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  No competitors enrolled on this roster yet. Click &quot;Enroll Player&quot; above to assign students.
                </td>
              </tr>
            ) : (
              roster.players.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-800/20">
                  <td className="py-2.5 font-medium text-white">{p.playerName}</td>
                  <td className="py-2.5">
                    <select
                      value={p.isCaptain ? 'captain' : p.role}
                      onChange={(e) =>
                        onUpdateRole(
                          roster.id,
                          p.id,
                          e.target.value as 'player' | 'sub' | 'captain'
                        )
                      }
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer focus:outline-none ${
                        p.isCaptain || p.role === 'captain'
                          ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                          : p.role === 'sub'
                          ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/30'
                      }`}
                    >
                      <option value="player">Starter</option>
                      <option value="sub">Sub</option>
                      <option value="captain">★ Captain</option>
                    </select>
                  </td>
                  <td className="py-2.5 font-mono text-zinc-300">{p.ign}</td>
                  <td className="py-2.5 font-mono text-zinc-400">{p.discordUsername}</td>
                  <td className="py-2.5">
                    {p.inGuild ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                        <span>In Server</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                        <HiOutlineExclamationTriangle className="w-3.5 h-3.5" />
                        <span>Missing</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      onPress={() => onRemovePlayer(roster.id, p.id)}
                      aria-label={`Remove ${p.playerName} from ${roster.name}`}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <HiOutlineTrash className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 5-Point Validation Gate Widget */}
      {gateResult ? (
        <div className="pt-3 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              5-Point Tournament Validation Gate
            </span>
            {gateResult.eligible ? (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 flex items-center gap-1">
                <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                <span>Eligible for Registration</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center gap-1">
                <HiOutlineExclamationTriangle className="w-3.5 h-3.5" />
                <span>Incomplete Gates ({gateResult.reasons.length})</span>
              </span>
            )}
          </div>

          {/* 5 Gate Checks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded bg-zinc-950 border border-zinc-800">
              {gateResult.gateChecks.minSize ? (
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <HiOutlineXCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                Size: {gateResult.stats.startersCount} Starters + {gateResult.stats.subsCount} Sub (Min 6)
              </span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-zinc-950 border border-zinc-800">
              {gateResult.gateChecks.singleCaptain ? (
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <HiOutlineXCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                Captain: {gateResult.stats.captainsCount === 1 ? 'Designated (1)' : `Invalid (${gateResult.stats.captainsCount})`}
              </span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-zinc-950 border border-zinc-800">
              {gateResult.gateChecks.riotLinked ? (
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <HiOutlineXCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                Riot ID: {gateResult.stats.riotLinkedCount}/{gateResult.stats.totalPlayers} Verified
              </span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-zinc-950 border border-zinc-800">
              {gateResult.gateChecks.discordLinked ? (
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <HiOutlineXCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                Discord: {gateResult.stats.discordLinkedCount}/{gateResult.stats.totalPlayers} Linked
              </span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-zinc-950 border border-zinc-800 sm:col-span-2">
              {gateResult.gateChecks.inGuild ? (
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <HiOutlineXCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                Server Presence: {gateResult.stats.inGuildCount}/{gateResult.stats.totalPlayers} In Discord Server
              </span>
            </div>
          </div>

          {/* Failure Reasons Details */}
          {!gateResult.eligible && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/50 text-xs text-amber-300 space-y-1">
              <p className="font-semibold">Action items required before roster confirmation:</p>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-300">
                {gateResult.reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
