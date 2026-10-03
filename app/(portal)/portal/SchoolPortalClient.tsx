'use client';

import React, { useState, useTransition } from 'react';
import type { SchoolManagerContext, ManagedSchoolInfo } from '@/app/lib/onboarding/manager-auth';
import {
  reviewPlayerInvite,
  getRosterEligibility,
  emergencySwapSub,
  enrollPlayerToRoster,
  removePlayerFromRoster,
  updateRosterPlayerRole,
  createSchoolRoster,
  deleteSchoolRoster,
  type SchoolInviteItem,
  type PendingSubmission,
  type SchoolRosterDetails,
  type SchoolPoolPlayer,
  type RosterEligibilityResult,
} from '@/app/lib/onboarding/portal-actions';
import { PortalHeader } from './components/PortalHeader';
import { GameTabs, type GameItem } from './components/GameTabs';
import { GenerateInviteCard } from './components/GenerateInviteCard';
import { PendingApprovalsCard } from './components/PendingApprovalsCard';
import { RostersSection } from './components/RostersSection';
import { InvitesHistoryTable } from './components/InvitesHistoryTable';
import { EmergencySwapModal } from './components/EmergencySwapModal';
import { EnrollPlayerModal } from './components/EnrollPlayerModal';
import { CreateRosterModal } from './components/CreateRosterModal';

export type { GameItem };

interface SchoolPortalClientProps {
  context: SchoolManagerContext;
  activeSchool: ManagedSchoolInfo;
  games: GameItem[];
  initialInvites: SchoolInviteItem[];
  initialSubmissions: PendingSubmission[];
  initialRosters: SchoolRosterDetails[];
  initialPlayerPool?: SchoolPoolPlayer[];
  selectedGameId?: string;
}

export default function SchoolPortalClient({
  context: _context,
  activeSchool,
  games,
  initialInvites,
  initialSubmissions,
  initialRosters,
  initialPlayerPool = [],
  selectedGameId: initialGameId,
}: SchoolPortalClientProps) {
  // --- Game Selection Tab ---
  const [selectedGame, setSelectedGame] = useState<string>(initialGameId || 'all');

  // --- Dynamic Data State ---
  const [invites, setInvites] = useState<SchoolInviteItem[]>(initialInvites);
  const [submissions, setSubmissions] = useState<PendingSubmission[]>(initialSubmissions);
  const [rosters, setRosters] = useState<SchoolRosterDetails[]>(initialRosters);
  const [playerPool, setPlayerPool] = useState<SchoolPoolPlayer[]>(initialPlayerPool);

  // --- Invite Generator State ---
  const [inviteGameId, setInviteGameId] = useState(
    initialGameId && initialGameId !== 'all' ? initialGameId : games[0]?.id || ''
  );

  // --- Approvals Queue State ---
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [selectedRosterMap, setSelectedRosterMap] = useState<Record<string, string>>({});
  const [selectedRoleMap, setSelectedRoleMap] = useState<Record<string, 'player' | 'sub' | 'captain'>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);

  // --- Roster Gate Evaluation State ---
  const [eligibilityResults, setEligibilityResults] = useState<
    Record<string, RosterEligibilityResult>
  >({});
  const [evaluatingRosterId, setEvaluatingRosterId] = useState<string | null>(null);

  // --- Emergency Sub Modal State ---
  const [activeSwapRoster, setActiveSwapRoster] = useState<SchoolRosterDetails | null>(null);
  const [outPlayerId, setOutPlayerId] = useState<string>('');
  const [inPlayerId, setInPlayerId] = useState<string>('');
  const [swapError, setSwapError] = useState<string | null>(null);
  const [isSwapping, startSwapping] = useTransition();

  // --- Enroll Player Modal State ---
  const [activeEnrollRoster, setActiveEnrollRoster] = useState<SchoolRosterDetails | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [enrollRole, setEnrollRole] = useState<'player' | 'sub' | 'captain'>('player');
  const [enrollCustomIgn, setEnrollCustomIgn] = useState<string>('');
  const [enrollSearchQuery, setEnrollSearchQuery] = useState<string>('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolling, startEnrolling] = useTransition();

  // --- Create Roster Modal State ---
  const [isCreateRosterOpen, setIsCreateRosterOpen] = useState(false);
  const [createRosterError, setCreateRosterError] = useState<string | null>(null);
  const [isCreatingRoster, startCreatingRoster] = useTransition();

  // --- Filtered Data ---
  const filteredInvites =
    selectedGame === 'all' ? invites : invites.filter((inv) => inv.gameId === selectedGame);

  const filteredSubmissions =
    selectedGame === 'all'
      ? submissions
      : submissions.filter((sub) => sub.gameId === selectedGame);

  const filteredRosters =
    selectedGame === 'all' ? rosters : rosters.filter((r) => r.gameId === selectedGame);

  // --- Handlers ---
  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard write failed gracefully
    }
  };

  const handleApprove = async (inviteId: string) => {
    setApprovingId(inviteId);
    setApprovalFeedback(null);
    try {
      const sub = submissions.find((s) => s.id === inviteId);
      const gameRosters = rosters.filter((r) => r.gameId === sub?.gameId);
      const chosenRosterId =
        selectedRosterMap[inviteId] !== undefined
          ? selectedRosterMap[inviteId]
          : (gameRosters[0]?.id || '');
      const chosenRole = (selectedRoleMap[inviteId] as 'player' | 'sub' | 'captain') || 'player';

      const result = await reviewPlayerInvite({
        inviteId,
        action: 'approve',
        rosterId: chosenRosterId || undefined,
        role: chosenRole,
      });

      if (result.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== inviteId));
        setInvites((prev) =>
          prev.map((inv) => (inv.id === inviteId ? { ...inv, status: 'accepted' } : inv))
        );

        if (result.enrolledPlayer && result.targetRosterId) {
          const enrolled = result.enrolledPlayer;
          const targetId = result.targetRosterId;
          setRosters((prev) =>
            prev.map((r) => {
              if (r.id !== targetId) return r;
              const updatedPlayers = r.players.map((p) =>
                enrolled.isCaptain && p.isCaptain ? { ...p, isCaptain: false, role: 'player' } : p
              );
              return {
                ...r,
                players: [
                  ...updatedPlayers.filter(
                    (p) => p.id !== enrolled.id && p.memberId !== enrolled.memberId
                  ),
                  enrolled,
                ],
              };
            })
          );
        }

        // Add to or update playerPool in client state
        if (sub && sub.memberId) {
          setPlayerPool((prev) => {
            const existing = prev.find((p) => p.memberId === sub.memberId);
            if (existing) {
              if (result.targetRosterId) {
                return prev.map((p) =>
                  p.memberId === sub.memberId
                    ? {
                        ...p,
                        enrolledRosters: [
                          ...p.enrolledRosters.filter((er) => er.rosterId !== result.targetRosterId),
                          {
                            rosterId: result.targetRosterId!,
                            rosterName: rosters.find((r) => r.id === result.targetRosterId)?.name || 'Roster',
                            gameName: sub.gameName,
                            role: chosenRole,
                            isCaptain: chosenRole === 'captain',
                          },
                        ],
                      }
                    : p
                );
              }
              return prev;
            }
            const newPoolPlayer: SchoolPoolPlayer = {
              memberId: sub.memberId!,
              firstName: sub.intendedFirstName,
              lastName: sub.intendedLastName,
              playerName: sub.playerName,
              ign: sub.ign,
              discordUsername: sub.discord,
              inGuild: true,
              riotVerified: true,
              graduationYear: null,
              enrolledRosters: result.targetRosterId
                ? [
                    {
                      rosterId: result.targetRosterId,
                      rosterName: rosters.find((r) => r.id === result.targetRosterId)?.name || 'Roster',
                      gameName: sub.gameName,
                      role: chosenRole,
                      isCaptain: chosenRole === 'captain',
                    },
                  ]
                : [],
            };
            return [newPoolPlayer, ...prev];
          });
        }

        const enrolledRoster = result.targetRosterId ? rosters.find((r) => r.id === result.targetRosterId) : null;
        setApprovalFeedback(
          enrolledRoster
            ? `Application approved! Player enrolled to ${enrolledRoster.name} (${enrolledRoster.gameName}) as ${chosenRole === 'captain' ? 'Captain' : chosenRole === 'sub' ? 'Substitute' : 'Starter'}.`
            : 'Application approved! Player added to school pool.'
        );
        setTimeout(() => setApprovalFeedback(null), 5000);
      }
    } catch (err: any) {
      setApprovalFeedback(`Approval failed: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleOpenEnrollModal = (roster: SchoolRosterDetails) => {
    setActiveEnrollRoster(roster);
    setSelectedMemberId('');
    setEnrollRole('player');
    setEnrollCustomIgn('');
    setEnrollSearchQuery('');
    setEnrollError(null);
  };

  const handleConfirmEnroll = () => {
    if (!activeEnrollRoster) return;
    if (!selectedMemberId) {
      setEnrollError('Please select a player to enroll.');
      return;
    }

    setEnrollError(null);
    startEnrolling(async () => {
      try {
        const result = await enrollPlayerToRoster({
          rosterId: activeEnrollRoster.id,
          memberId: selectedMemberId,
          role: enrollRole,
          ign: enrollCustomIgn.trim() || undefined,
        });

        if (result.success) {
          const enrolled = result.player;
          setRosters((prev) =>
            prev.map((r) => {
              if (r.id !== activeEnrollRoster.id) return r;
              const updatedPlayers = r.players.map((p) =>
                enrolled.isCaptain && p.isCaptain ? { ...p, isCaptain: false, role: 'player' } : p
              );
              return {
                ...r,
                players: [
                  ...updatedPlayers.filter(
                    (p) => p.id !== enrolled.id && p.memberId !== enrolled.memberId
                  ),
                  enrolled,
                ],
              };
            })
          );

          setPlayerPool((prev) =>
            prev.map((p) => {
              if (p.memberId !== selectedMemberId) return p;
              const otherRosters = p.enrolledRosters.filter(
                (er) => er.rosterId !== activeEnrollRoster.id
              );
              return {
                ...p,
                enrolledRosters: [
                  ...otherRosters,
                  {
                    rosterId: activeEnrollRoster.id,
                    rosterName: activeEnrollRoster.name,
                    gameName: activeEnrollRoster.gameName,
                    role: enrollRole,
                    isCaptain: enrollRole === 'captain',
                  },
                ],
              };
            })
          );

          setActiveEnrollRoster(null);
        }
      } catch (err: any) {
        setEnrollError(err.message || 'Failed to enroll player to roster');
      }
    });
  };

  const handleRemovePlayer = async (rosterId: string, playerId: string) => {
    try {
      await removePlayerFromRoster({ rosterId, playerId });
      setRosters((prev) =>
        prev.map((r) => {
          if (r.id !== rosterId) return r;
          return {
            ...r,
            players: r.players.filter((p) => p.id !== playerId),
          };
        })
      );
      setPlayerPool((prev) =>
        prev.map((p) => ({
          ...p,
          enrolledRosters: p.enrolledRosters.filter((er) => er.rosterId !== rosterId),
        }))
      );
    } catch (err: any) {
      alert(`Failed to remove player: ${err.message}`);
    }
  };

  const handleConfirmCreateRoster = ({
    gameId,
    name,
    division,
  }: {
    gameId: string;
    name: string;
    division: string;
  }) => {
    setCreateRosterError(null);
    startCreatingRoster(async () => {
      try {
        const result = await createSchoolRoster({
          schoolId: activeSchool.schoolId,
          gameId,
          name,
          division,
        });

        if (result.success) {
          setRosters((prev) => [...prev, result.roster]);
          setIsCreateRosterOpen(false);
          setApprovalFeedback(`Roster "${result.roster.name}" created successfully!`);
          setTimeout(() => setApprovalFeedback(null), 4000);
        }
      } catch (err: any) {
        setCreateRosterError(err.message || 'Failed to create roster');
      }
    });
  };

  const handleDeleteRoster = async (rosterId: string) => {
    if (!confirm('Are you sure you want to delete this empty roster?')) return;
    try {
      await deleteSchoolRoster(rosterId);
      setRosters((prev) => prev.filter((r) => r.id !== rosterId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete roster');
    }
  };

  const handleUpdateRole = async (
    rosterId: string,
    playerId: string,
    newRole: 'player' | 'sub' | 'captain'
  ) => {
    try {
      await updateRosterPlayerRole({ rosterId, playerId, role: newRole });
      setRosters((prev) =>
        prev.map((r) => {
          if (r.id !== rosterId) return r;
          return {
            ...r,
            players: r.players.map((p) => {
              if (p.id === playerId) {
                return { ...p, role: newRole, isCaptain: newRole === 'captain' };
              }
              if (newRole === 'captain' && p.isCaptain) {
                return { ...p, role: 'player', isCaptain: false };
              }
              return p;
            }),
          };
        })
      );
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  const handleReject = async (inviteId: string) => {
    setRejectingId(inviteId);
    setApprovalFeedback(null);
    try {
      const result = await reviewPlayerInvite({
        inviteId,
        action: 'reject',
      });

      if (result.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== inviteId));
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === inviteId
              ? { ...inv, status: 'rejected', rejectionReason: result.rejectionReason ?? null }
              : inv
          )
        );
        setApprovalFeedback('Application rejected.');
        setTimeout(() => setApprovalFeedback(null), 4000);
      }
    } catch (err: any) {
      setApprovalFeedback(`Rejection failed: ${err.message}`);
    } finally {
      setRejectingId(null);
    }
  };

  const handleCheckRosterGate = async (rosterId: string) => {
    setEvaluatingRosterId(rosterId);
    try {
      const res = await getRosterEligibility({ rosterId });
      setEligibilityResults((prev) => ({ ...prev, [rosterId]: res }));
    } catch (err: any) {
      console.error('Failed to evaluate roster gate', err);
    } finally {
      setEvaluatingRosterId(null);
    }
  };

  const handleOpenSwapModal = (roster: SchoolRosterDetails) => {
    setActiveSwapRoster(roster);
    const starters = roster.players.filter(
      (p) => p.role === 'player' || p.role === 'captain' || p.isCaptain
    );
    const subs = roster.players.filter((p) => p.role === 'sub');
    setOutPlayerId(starters[0]?.id || '');
    setInPlayerId(subs[0]?.id || '');
    setSwapError(null);
  };

  const handleConfirmSwap = () => {
    if (!activeSwapRoster || !outPlayerId || !inPlayerId) {
      setSwapError('Please select both a starter and a substitute.');
      return;
    }

    setSwapError(null);
    startSwapping(async () => {
      try {
        const result = await emergencySwapSub({
          rosterId: activeSwapRoster.id,
          outPlayerId,
          inPlayerId,
        });

        if (result.success) {
          setRosters((prev) =>
            prev.map((r) => {
              if (r.id !== activeSwapRoster.id) return r;
              const outP = r.players.find((p) => p.id === outPlayerId);
              const inP = r.players.find((p) => p.id === inPlayerId);
              if (!outP || !inP) return r;

              const prevOutRole = outP.role;
              const prevOutCaptain = outP.isCaptain;

              const updatedPlayers = r.players.map((p) => {
                if (p.id === outPlayerId) {
                  return { ...p, role: 'sub', isCaptain: false };
                }
                if (p.id === inPlayerId) {
                  return {
                    ...p,
                    role: prevOutRole === 'captain' ? 'captain' : 'player',
                    isCaptain: prevOutCaptain,
                  };
                }
                return p;
              });

              return { ...r, players: updatedPlayers };
            })
          );

          setActiveSwapRoster(null);
        }
      } catch (err: any) {
        setSwapError(err.message || 'Substitution swap failed');
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Title */}
      <PortalHeader schoolName={activeSchool.schoolName} />

      {/* Game Filter Tabs */}
      <GameTabs
        games={games}
        selectedGame={selectedGame}
        onSelectGame={(gameId) => {
          setSelectedGame(gameId);
          if (gameId !== 'all') {
            setInviteGameId(gameId);
          }
        }}
      />

      {/* Action Grid: Invite Generator & Approvals Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <GenerateInviteCard
            games={games}
            schoolId={activeSchool.schoolId}
            schoolSlug={activeSchool.schoolSlug}
            inviteGameId={inviteGameId}
            setInviteGameId={setInviteGameId}
            onInviteCreated={(newInvite) => setInvites((prev) => [newInvite, ...prev])}
          />
        </div>

        <div className="lg:col-span-7 space-y-4">
          <PendingApprovalsCard
            submissions={filteredSubmissions}
            rosters={rosters}
            approvingId={approvingId}
            rejectingId={rejectingId}
            approvalFeedback={approvalFeedback}
            selectedRosterMap={selectedRosterMap}
            setSelectedRosterMap={setSelectedRosterMap}
            selectedRoleMap={selectedRoleMap}
            setSelectedRoleMap={setSelectedRoleMap}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      </div>

      {/* Team Roster Builder & 5-Point Live Validation Checklist */}
      <RostersSection
        rosters={filteredRosters}
        schoolName={activeSchool.schoolName}
        eligibilityResults={eligibilityResults}
        evaluatingRosterId={evaluatingRosterId}
        onOpenCreateRosterModal={() => {
          setIsCreateRosterOpen(true);
          setCreateRosterError(null);
        }}
        onOpenEnrollModal={handleOpenEnrollModal}
        onOpenSwapModal={handleOpenSwapModal}
        onCheckRosterGate={handleCheckRosterGate}
        onUpdateRole={handleUpdateRole}
        onRemovePlayer={handleRemovePlayer}
        onDeleteRoster={handleDeleteRoster}
      />

      {/* Invites Sent Table */}
      <InvitesHistoryTable
        invites={filteredInvites}
        onCopyLink={handleCopyLink}
      />

      {/* Emergency Sub Swap Modal */}
      <EmergencySwapModal
        roster={activeSwapRoster}
        outPlayerId={outPlayerId}
        setOutPlayerId={setOutPlayerId}
        inPlayerId={inPlayerId}
        setInPlayerId={setInPlayerId}
        swapError={swapError}
        isSwapping={isSwapping}
        onConfirmSwap={handleConfirmSwap}
        onClose={() => setActiveSwapRoster(null)}
      />

      {/* Enroll Player to Roster Modal */}
      <EnrollPlayerModal
        roster={activeEnrollRoster}
        playerPool={playerPool}
        selectedMemberId={selectedMemberId}
        setSelectedMemberId={setSelectedMemberId}
        enrollRole={enrollRole}
        setEnrollRole={setEnrollRole}
        enrollCustomIgn={enrollCustomIgn}
        setEnrollCustomIgn={setEnrollCustomIgn}
        enrollSearchQuery={enrollSearchQuery}
        setEnrollSearchQuery={setEnrollSearchQuery}
        enrollError={enrollError}
        isEnrolling={isEnrolling}
        onConfirmEnroll={handleConfirmEnroll}
        onClose={() => setActiveEnrollRoster(null)}
      />

      {/* Create Team Roster Modal */}
      <CreateRosterModal
        isOpen={isCreateRosterOpen}
        schoolName={activeSchool.schoolName}
        games={games}
        defaultGameId={selectedGame}
        isCreating={isCreatingRoster}
        createError={createRosterError}
        onConfirmCreate={handleConfirmCreateRoster}
        onClose={() => {
          setIsCreateRosterOpen(false);
          setCreateRosterError(null);
        }}
      />
    </div>
  );
}
