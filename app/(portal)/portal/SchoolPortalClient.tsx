'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type { SchoolManagerContext, ManagedSchoolInfo } from '@/app/lib/onboarding/manager-auth';
import {
  reviewPlayerInvite,
  getRosterEligibility,
  enrollPlayerToRoster,
  removePlayerFromRoster,
  movePlayerToRoster,
  updateRosterPlayerRole,
  createSchoolRoster,
  deleteSchoolRoster,
  regeneratePlayerInviteLink,
  deletePlayerInvite,
  type SchoolInviteItem,
  type PendingSubmission,
  type SchoolRosterDetails,
  type SchoolPoolPlayer,
  type RosterEligibilityResult,
} from '@/app/lib/onboarding/portal-actions';
import type { SchoolMatchItem } from '@/app/lib/school-matches';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { useConfirmAction } from '@/app/components/admin/useConfirmAction';
import { rosterRemovalConfirmMessage } from '@/app/lib/roster-removal-copy';
import { StaffActingProvider, useStaffActing } from './components/StaffActing';
import { PortalHeader } from './components/PortalHeader';
import { GameTabs, type GameItem } from './components/GameTabs';
import { GenerateInviteCard } from './components/GenerateInviteCard';
import { PendingApprovalsCard } from './components/PendingApprovalsCard';
import { RostersSection } from './components/RostersSection';
import { InvitesHistoryTable } from './components/InvitesHistoryTable';
import { MatchesSection } from './components/MatchesSection';
import { EnrollPlayerModal } from './components/EnrollPlayerModal';
import { CreateRosterModal } from './components/CreateRosterModal';
import PortalTour from './tour/PortalTour';

export type { GameItem };

function inviteStudentName(invite: SchoolInviteItem | null): string {
  return invite ? `${invite.intendedFirstName} ${invite.intendedLastName}`.trim() : 'this student';
}

interface SchoolPortalClientProps {
  context: SchoolManagerContext;
  activeSchool: ManagedSchoolInfo;
  games: GameItem[];
  initialInvites: SchoolInviteItem[];
  initialSubmissions: PendingSubmission[];
  initialRosters: SchoolRosterDetails[];
  initialPlayerPool?: SchoolPoolPlayer[];
  /** The school's matches (read-only) and the server clock that splits them into Upcoming/Past. */
  matches: SchoolMatchItem[];
  matchesNowIso: string;
  selectedGameId?: string;
  /** Season name(s) the manager is working in (matched by name); undefined for a staff admin. */
  seasonLabel?: string;
  /** Whether any of the manager's seasons is inactive (view-only, spec-028). */
  hasInactiveSeason?: boolean;
  /** Games whose season is inactive: every write control is disabled (server enforces it). */
  viewOnlyGameIds?: string[];
  /** Name(s) of the view-only season(s), for the banner. */
  viewOnlySeasonLabel?: string;
  /** Games whose season rosters are locked by staff (always empty for staff admins). */
  lockedGameIds?: string[];
  /** Name(s) of the locked season(s), for the banner. */
  lockedSeasonLabel?: string;
  /** Whether this account has already finished or skipped the guided tour. */
  tourCompleted: boolean;
}

/**
 * The portal for one school. A staff admin viewing it can do everything its manager can; each
 * mutation then asks for one confirmation first (spec-054). A manager is never asked.
 */
export default function SchoolPortalClient(props: SchoolPortalClientProps) {
  return (
    <StaffActingProvider isStaff={!!props.context?.isStaffAdmin} schoolName={props.activeSchool.schoolName}>
      <SchoolPortalContent {...props} />
    </StaffActingProvider>
  );
}

function SchoolPortalContent({
  context: _context,
  activeSchool,
  games,
  initialInvites,
  initialSubmissions,
  initialRosters,
  initialPlayerPool = [],
  matches,
  matchesNowIso,
  selectedGameId: initialGameId,
  seasonLabel,
  hasInactiveSeason = false,
  viewOnlyGameIds = [],
  viewOnlySeasonLabel = '',
  lockedGameIds = [],
  lockedSeasonLabel = '',
  tourCompleted,
}: SchoolPortalClientProps) {
  const { confirmed, actingNotice } = useStaffActing();
  // Staff see one dialog, not two, for the portal's own confirms: the notice leads their message.
  const withNotice = (message: string) => (actingNotice ? `${actingNotice} ${message}` : message);

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
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);
  // Outcome of the last roster Move, announced politely by the Rosters section.
  const [rosterNotice, setRosterNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  // The player row whose move is in flight; its Move control is disabled so it cannot be double-fired.
  const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);

  // --- Roster Gate Evaluation State ---
  const [eligibilityResults, setEligibilityResults] = useState<
    Record<string, RosterEligibilityResult>
  >({});
  const [evaluatingRosterId, setEvaluatingRosterId] = useState<string | null>(null);

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

  const filteredMatches =
    selectedGame === 'all' ? matches : matches.filter((m) => m.gameId === selectedGame);

  // --- Handlers ---
  // The invite whose fresh link was just copied, and the link itself when the clipboard refused it.
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<{ inviteId: string; url: string } | null>(null);
  useEffect(() => {
    if (!copiedInviteId) return;
    const timer = setTimeout(() => setCopiedInviteId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedInviteId]);

  // Only the token hash is stored, so "copy" issues a new link (the old one stops working) and
  // copies it straight away. It runs from the confirm dialog because it invalidates the old link.
  const [copyAnnouncement, setCopyAnnouncement] = useState('');

  // A refusal carries the invite's current state: drop a row that is gone, correct a stale status.
  const syncStaleInvite = (inviteId: string, status: string | null) => {
    if (status === 'forbidden') return;
    setInvites((prev) =>
      status === null
        ? prev.filter((inv) => inv.id !== inviteId)
        : prev.map((inv) => (inv.id === inviteId ? { ...inv, status } : inv))
    );
  };

  const inviteLinkCopy = useConfirmAction<SchoolInviteItem>(async (invite) => {
    let result;
    try {
      result = await regeneratePlayerInviteLink(invite.id);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create a new link' };
    }
    if (!result.success) {
      syncStaleInvite(invite.id, result.status);
      return { success: false, error: result.error };
    }
    const url = window.location.origin + result.inviteUrl;
    setInvites((prev) =>
      prev.map((inv) => (inv.id === invite.id ? { ...inv, expiresAt: result.expiresAt } : inv))
    );
    try {
      await navigator.clipboard.writeText(url);
      setManualLink(null);
      setCopiedInviteId(invite.id);
      setCopyAnnouncement('Link copied');
    } catch {
      setManualLink({ inviteId: invite.id, url });
      setCopyAnnouncement('Copy failed, link shown below');
    }
    return { success: true };
  }, 'Failed to create a new link');

  const inviteDeletion = useConfirmAction<SchoolInviteItem>(async (invite) => {
    let result;
    try {
      result = await deletePlayerInvite(invite.id);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete invite' };
    }
    if (!result.success) {
      syncStaleInvite(invite.id, result.status);
      return { success: false, error: result.error };
    }
    setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
    setManualLink((prev) => (prev?.inviteId === invite.id ? null : prev));
    return { success: true };
  }, 'Failed to delete invite');

  // Approving only accepts the student; the manager then enrolls them onto any roster of the game
  // (Varsity or JV) from that roster's Enroll button, where the pool lists accepted students.
  const handleApprove = async (inviteId: string) => {
    setApprovingId(inviteId);
    setApprovalFeedback(null);
    try {
      const sub = submissions.find((s) => s.id === inviteId);
      const result = await reviewPlayerInvite({ inviteId, action: 'approve' });

      if (!result.success) {
        setApprovalFeedback(result.error);
        return;
      }

      setSubmissions((prev) => prev.filter((s) => s.id !== inviteId));
      setInvites((prev) =>
        prev.map((inv) => (inv.id === inviteId ? { ...inv, status: 'accepted' } : inv))
      );

      // The student is already a member of the school; make sure they are in the client-side pool
      // so the Enroll dialog offers them without a reload.
      if (sub?.memberId) {
        setPlayerPool((prev) => {
          if (prev.some((p) => p.memberId === sub.memberId)) {
            // Mark this application accepted so the Enroll dialog now offers the student.
            const accepted = { id: inviteId, gameId: sub.gameId, seasonId: sub.seasonId, status: 'accepted' };
            return prev.map((p) => {
              if (p.memberId !== sub.memberId || !p.invites) return p;
              // Flip the known row, or add it when the pool was loaded before this application existed.
              return p.invites.some((i) => i.id === inviteId)
                ? { ...p, invites: p.invites.map((i) => (i.id === inviteId ? { ...i, status: 'accepted' } : i)) }
                : { ...p, invites: [...p.invites, accepted] };
            });
          }
          const accepted: SchoolPoolPlayer = {
            memberId: sub.memberId!,
            firstName: sub.intendedFirstName,
            lastName: sub.intendedLastName,
            playerName: sub.playerName,
            ign: sub.ign,
            discordUsername: sub.discord,
            inGuild: true,
            riotVerified: true,
            graduationYear: null,
            invites: [{ id: inviteId, gameId: sub.gameId, seasonId: sub.seasonId, status: 'accepted' }],
            enrolledRosters: [],
          };
          return [accepted, ...prev];
        });
      }

      setApprovalFeedback(
        `${sub?.playerName ?? 'The student'} accepted. Use Enroll on a roster to put them on Varsity or JV.`
      );
      setTimeout(() => setApprovalFeedback(null), 5000);
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
    // The check above ran first, so staff are only asked about an enrollment that can be sent.
    confirmed(() => startEnrolling(async () => {
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
                    gameId: activeEnrollRoster.gameId,
                    seasonId: activeEnrollRoster.seasonId,
                    role: enrollRole,
                    isCaptain: enrollRole === 'captain',
                  },
                ],
              };
            })
          );

          setActiveEnrollRoster(null);
        } else {
          setEnrollError(result.error);
        }
      } catch (err: any) {
        setEnrollError(err.message || 'Failed to enroll player to roster');
      }
    }));
  };

  // Removing only runs from the confirm dialog. Whether the student's own record also goes depends
  // on the server (other roster, staff, match history), so the outcome sentence comes from it.
  const playerRemoval = useConfirmAction<{ rosterId: string; playerId: string; memberId: string | null; playerName: string; rosterName: string }>(
    async ({ rosterId, playerId, memberId }) => {
      try {
        const result = await removePlayerFromRoster({ rosterId, playerId });
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
          result.studentRecord === 'deleted'
            ? prev.filter((p) => p.memberId !== memberId)
            : prev.map((p) =>
                p.memberId === memberId
                  ? { ...p, enrolledRosters: p.enrolledRosters.filter((er) => er.rosterId !== rosterId) }
                  : p
              )
        );
        setRosterNotice({ kind: 'success', text: result.message });
        return { success: true };
      } catch (err: any) {
        const text = `Failed to remove player: ${err?.message || 'unknown error'}`;
        setRosterNotice({ kind: 'error', text });
        return { success: false, error: text };
      }
    },
    'Failed to remove player'
  );

  const handleRemovePlayer = (rosterId: string, playerId: string) => {
    setRosterNotice(null);
    const roster = rosters.find((r) => r.id === rosterId);
    const player = roster?.players.find((p) => p.id === playerId);
    playerRemoval.request({
      rosterId,
      playerId,
      memberId: player?.memberId ?? null,
      playerName: player?.playerName ?? 'This player',
      rosterName: roster?.name ?? 'this roster',
    });
  };

  const handleMovePlayer = async (fromRosterId: string, playerId: string, toRosterId: string) => {
    setMovingPlayerId(playerId);
    setRosterNotice(null);
    try {
      const moved = await movePlayerToRoster({ fromRosterId, playerId, toRosterId });
      if (!moved.success) {
        setRosterNotice({ kind: 'error', text: moved.error });
        return;
      }
      setRosters((prev) => {
        const source = prev.find((r) => r.id === fromRosterId);
        const player = source?.players.find((p) => p.id === playerId);
        if (!player) return prev;
        // Same row, new roster: a moved captain arrives as a starter (captaincy is per roster).
        const arrived = { ...player, role: moved.role, isCaptain: moved.isCaptain };
        return prev.map((r) => {
          if (r.id === fromRosterId) return { ...r, players: r.players.filter((p) => p.id !== playerId) };
          if (r.id === toRosterId) return { ...r, players: [...r.players, arrived] };
          return r;
        });
      });
      setPlayerPool((prev) =>
        prev.map((p) =>
          p.memberId !== moved.memberId
            ? p
            : {
                ...p,
                enrolledRosters: p.enrolledRosters.map((er) =>
                  er.rosterId === fromRosterId
                    ? { ...er, rosterId: toRosterId, rosterName: moved.toRosterName, role: moved.role, isCaptain: moved.isCaptain }
                    : er
                ),
              }
        )
      );
      setRosterNotice({
        kind: 'success',
        text: `${moved.playerName} moved from ${moved.fromRosterName} to ${moved.toRosterName}.${
          moved.wasCaptain ? ` They were captain, so choose a new captain for ${moved.fromRosterName}.` : ''
        }`,
      });
    } catch (err: any) {
      setRosterNotice({ kind: 'error', text: `Failed to move player: ${err.message}` });
    } finally {
      setMovingPlayerId(null);
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

  // Deleting only runs from the confirm dialog. A failure stays in the dialog and is
  // also mirrored to the roster notice so it survives a cancel.
  const rosterDeletion = useConfirmAction<string>(async (rosterId) => {
    try {
      await deleteSchoolRoster(rosterId);
    } catch (err: any) {
      const text = err?.message || 'Failed to delete roster';
      setRosterNotice({ kind: 'error', text });
      return { success: false, error: text };
    }
    setRosters((prev) => prev.filter((r) => r.id !== rosterId));
    return { success: true };
  }, 'Failed to delete roster');

  const handleDeleteRoster = (rosterId: string) => {
    setRosterNotice(null);
    rosterDeletion.request(rosterId);
  };

  const handleUpdateRole = async (
    rosterId: string,
    playerId: string,
    newRole: 'player' | 'sub' | 'captain'
  ) => {
    try {
      const res = await updateRosterPlayerRole({ rosterId, playerId, role: newRole });
      if (!res.success) {
        // For example the roster already has its maximum number of subs; the select snaps back.
        setRosterNotice({ kind: 'error', text: res.error });
        return;
      }
      setRosterNotice(null);
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

  return (
    <div className="space-y-8">
      {/* Top Banner & Title */}
      <PortalHeader
        schoolName={activeSchool.schoolName}
        seasonLabel={seasonLabel}
        hasInactiveSeason={hasInactiveSeason}
        actions={
          <PortalTour
            tourCompleted={tourCompleted}
            accountId={_context.userId}
            schoolName={activeSchool.schoolName}
          />
        }
      />

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
        <div className="min-w-0 lg:col-span-5 space-y-6">
          <GenerateInviteCard
            games={games}
            schoolId={activeSchool.schoolId}
            schoolSlug={activeSchool.schoolSlug}
            inviteGameId={inviteGameId}
            setInviteGameId={setInviteGameId}
            viewOnlyGameIds={viewOnlyGameIds}
            onInviteCreated={(newInvite) => setInvites((prev) => [newInvite, ...prev])}
          />
        </div>

        <div className="min-w-0 lg:col-span-7 space-y-4">
          <PendingApprovalsCard
            submissions={filteredSubmissions}
            approvingId={approvingId}
            rejectingId={rejectingId}
            approvalFeedback={approvalFeedback}
            viewOnlyGameIds={viewOnlyGameIds}
            onApprove={(id) => confirmed(() => handleApprove(id))}
            onReject={(id) => confirmed(() => handleReject(id))}
          />
        </div>
      </div>

      {/* Team Roster Builder & 5-Point Live Validation Checklist */}
      <RostersSection
        rosters={filteredRosters}
        schoolName={activeSchool.schoolName}
        lockedGameIds={lockedGameIds}
        lockedSeasonLabel={lockedSeasonLabel}
        viewOnlyGameIds={viewOnlyGameIds}
        viewOnlySeasonLabel={viewOnlySeasonLabel}
        allGameIds={games.map((g) => g.id)}
        eligibilityResults={eligibilityResults}
        evaluatingRosterId={evaluatingRosterId}
        onOpenCreateRosterModal={() => {
          setIsCreateRosterOpen(true);
          setCreateRosterError(null);
        }}
        onOpenEnrollModal={handleOpenEnrollModal}
        onCheckRosterGate={handleCheckRosterGate}
        onUpdateRole={(rosterId, playerId, role) => confirmed(() => handleUpdateRole(rosterId, playerId, role))}
        onRemovePlayer={handleRemovePlayer}
        onMovePlayer={(fromRosterId, playerId, toRosterId) =>
          confirmed(() => handleMovePlayer(fromRosterId, playerId, toRosterId))
        }
        movingPlayerId={movingPlayerId}
        notice={rosterNotice}
        onDeleteRoster={handleDeleteRoster}
      />

      {/* Scheduled matches (read-only) */}
      <MatchesSection
        matches={filteredMatches}
        schoolId={activeSchool.schoolId}
        viewOnlyGameIds={viewOnlyGameIds}
        nowIso={matchesNowIso}
        showGame={selectedGame === 'all' && games.length > 1}
      />

      {/* Invites Sent Table */}
      <InvitesHistoryTable
        invites={filteredInvites}
        onCopyLink={(inv) => {
          setManualLink(null);
          setCopyAnnouncement('');
          inviteLinkCopy.request(inv);
        }}
        onDelete={inviteDeletion.request}
        viewOnlyGameIds={viewOnlyGameIds}
        copiedId={copiedInviteId}
        manualLink={manualLink}
        announcement={copyAnnouncement}
      />

      <ConfirmActionDialog
        {...inviteLinkCopy.dialogProps}
        appearance="portal"
        tone="danger"
        title="Copy a new invite link?"
        message={withNotice(
          `This replaces the current link for ${inviteStudentName(inviteLinkCopy.target)}. The old link will stop working and the new link is copied to your clipboard.`,
        )}
        confirmLabel="Copy new link"
        pendingLabel="Creating…"
      />

      <ConfirmActionDialog
        {...inviteDeletion.dialogProps}
        appearance="portal"
        tone="danger"
        title="Delete invite?"
        message={withNotice(
          `Delete the invite for ${inviteStudentName(inviteDeletion.target)}? Its link will stop working. This action cannot be undone.`,
        )}
        confirmLabel="Delete invite"
        pendingLabel="Deleting…"
      />

      <ConfirmActionDialog
        {...playerRemoval.dialogProps}
        appearance="portal"
        tone="danger"
        title="Remove player?"
        message={withNotice(
          rosterRemovalConfirmMessage(
            playerRemoval.target?.playerName ?? 'This player',
            playerRemoval.target?.rosterName ?? 'this roster',
          ),
        )}
        confirmLabel="Remove player"
        pendingLabel="Removing…"
      />

      <ConfirmActionDialog
        {...rosterDeletion.dialogProps}
        appearance="portal"
        tone="danger"
        title="Delete roster?"
        message={withNotice('Delete this roster? This will remove it permanently. This action cannot be undone.')}
        confirmLabel="Delete roster"
        pendingLabel="Deleting…"
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
        games={games.filter((g) => !lockedGameIds.includes(g.id) && !viewOnlyGameIds.includes(g.id))}
        defaultGameId={selectedGame}
        isCreating={isCreatingRoster}
        createError={createRosterError}
        onConfirmCreate={(input) => confirmed(() => handleConfirmCreateRoster(input))}
        onClose={() => {
          setIsCreateRosterOpen(false);
          setCreateRosterError(null);
        }}
      />
    </div>
  );
}
