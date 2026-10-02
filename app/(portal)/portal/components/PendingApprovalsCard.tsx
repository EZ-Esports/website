'use client';

import React from 'react';
import { Button } from 'react-aria-components';
import { HiOutlineUsers } from 'react-icons/hi2';
import type {
  PendingSubmission,
  SchoolRosterDetails,
} from '@/app/lib/onboarding/portal-actions';

interface PendingApprovalsCardProps {
  submissions: PendingSubmission[];
  rosters: SchoolRosterDetails[];
  approvingId: string | null;
  rejectingId: string | null;
  approvalFeedback: string | null;
  selectedRosterMap: Record<string, string>;
  setSelectedRosterMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedRoleMap: Record<string, 'player' | 'sub' | 'captain'>;
  setSelectedRoleMap: React.Dispatch<
    React.SetStateAction<Record<string, 'player' | 'sub' | 'captain'>>
  >;
  onApprove: (inviteId: string) => void;
  onReject: (inviteId: string) => void;
}

export function PendingApprovalsCard({
  submissions,
  rosters,
  approvingId,
  rejectingId,
  approvalFeedback,
  selectedRosterMap,
  setSelectedRosterMap,
  selectedRoleMap,
  setSelectedRoleMap,
  onApprove,
  onReject,
}: PendingApprovalsCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Pending Approvals Queue</h2>
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
            {submissions.length}
          </span>
        </div>
        <span className="text-xs text-zinc-500">Verified Onboarding Submissions</span>
      </div>

      {approvalFeedback && (
        <div className="p-3 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200">
          {approvalFeedback}
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
          <HiOutlineUsers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-300">No applications waiting for review</p>
          <p className="text-xs text-zinc-500 mt-1">
            When students complete their one-time onboarding link, their verified IGN and Discord handle will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const gameRosters = rosters.filter((r) => r.gameId === sub.gameId);
            const isApproving = approvingId === sub.id;
            const isRejecting = rejectingId === sub.id;

            return (
              <div
                key={sub.id}
                className="p-4 sm:p-5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-colors space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{sub.playerName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {sub.gameName}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Submitted {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'recently'}
                    </p>
                  </div>

                  <div className="text-xs text-zinc-400 font-medium">
                    Grade: <span className="text-white font-semibold">{sub.grade}</span>
                  </div>
                </div>

                {/* Verified Details Badges (Zero-PII: IGN + Discord only) */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-0.5">
                      In-Game ID (Riot)
                    </span>
                    <span className="font-mono font-semibold text-zinc-200">{sub.ign}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-0.5">
                      Discord Handle
                    </span>
                    <span className="font-mono font-semibold text-zinc-200">{sub.discord}</span>
                  </div>
                </div>

                {/* Actions: Assign Roster + Role + Approve / Reject */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-400 shrink-0">Roster:</span>
                      <select
                        value={
                          selectedRosterMap[sub.id] !== undefined
                            ? selectedRosterMap[sub.id]
                            : (gameRosters[0]?.id || '')
                        }
                        onChange={(e) =>
                          setSelectedRosterMap((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        className="px-2.5 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-white focus:outline-none"
                      >
                        {gameRosters.length > 0 && (
                          <optgroup label={`${sub.gameName} Rosters`}>
                            {gameRosters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.division})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {rosters.filter((r) => r.gameId !== sub.gameId).length > 0 && (
                          <optgroup label="Other Rosters">
                            {rosters
                              .filter((r) => r.gameId !== sub.gameId)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.gameName} &bull; {r.name} ({r.division})
                                </option>
                              ))}
                          </optgroup>
                        )}
                        <option value="">None (School Pool only)</option>
                      </select>
                    </div>

                    {(selectedRosterMap[sub.id] || (selectedRosterMap[sub.id] === undefined && gameRosters[0]?.id)) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400 shrink-0">Role:</span>
                        <select
                          value={selectedRoleMap[sub.id] || 'player'}
                          onChange={(e) =>
                            setSelectedRoleMap((prev) => ({
                              ...prev,
                              [sub.id]: e.target.value as 'player' | 'sub' | 'captain',
                            }))
                          }
                          className="px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-white focus:outline-none"
                        >
                          <option value="player">Starter</option>
                          <option value="sub">Substitute</option>
                          <option value="captain">Captain</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      onPress={() => onReject(sub.id)}
                      isDisabled={isRejecting || isApproving}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Reject
                    </Button>
                    <Button
                      onPress={() => onApprove(sub.id)}
                      isDisabled={isApproving || isRejecting}
                      className="px-3.5 py-1.5 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isApproving ? 'Approving...' : 'Approve & Enroll'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
