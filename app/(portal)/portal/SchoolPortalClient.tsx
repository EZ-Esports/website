'use client';

import React, { useState, useTransition } from 'react';
import { Button } from 'react-aria-components';
import type { SchoolManagerContext, ManagedSchoolInfo } from '@/app/lib/onboarding/manager-auth';
import {
  createPlayerInvite,
  reviewPlayerInvite,
  getRosterEligibility,
  emergencySwapSub,
  type SchoolInviteItem,
  type PendingSubmission,
  type SchoolRosterDetails,
  type RosterEligibilityResult,
} from '@/app/lib/onboarding/portal-actions';
import {
  HiOutlineUserPlus,
  HiOutlineClipboardDocument,
  HiOutlineCheck,
  HiOutlineExclamationTriangle,
  HiOutlineShieldCheck,
  HiOutlineArrowsRightLeft,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineUsers,
  HiOutlineSparkles,
  HiOutlineXMark,
} from 'react-icons/hi2';

interface GameItem {
  id: string;
  slug: string;
  displayName: string;
  shortName: string;
}

interface SchoolPortalClientProps {
  context: SchoolManagerContext;
  activeSchool: ManagedSchoolInfo;
  games: GameItem[];
  initialInvites: SchoolInviteItem[];
  initialSubmissions: PendingSubmission[];
  initialRosters: SchoolRosterDetails[];
  selectedGameId?: string;
}

export default function SchoolPortalClient({
  context: _context,
  activeSchool,
  games,
  initialInvites,
  initialSubmissions,
  initialRosters,
  selectedGameId: initialGameId,
}: SchoolPortalClientProps) {
  // --- Game Selection Tab ---
  const [selectedGame, setSelectedGame] = useState<string>(initialGameId || 'all');

  // --- Dynamic Data State ---
  const [invites, setInvites] = useState<SchoolInviteItem[]>(initialInvites);
  const [submissions, setSubmissions] = useState<PendingSubmission[]>(initialSubmissions);
  const [rosters, setRosters] = useState<SchoolRosterDetails[]>(initialRosters);

  // --- Invite Generator State ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [inviteGameId, setInviteGameId] = useState(
    initialGameId && initialGameId !== 'all' ? initialGameId : games[0]?.id || ''
  );
  const [expiryDays, setExpiryDays] = useState(7);
  const [generatedInvite, setGeneratedInvite] = useState<{
    url: string;
    studentName: string;
    expiresAt: Date;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  // --- Approvals Queue State ---
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [selectedRosterMap, setSelectedRosterMap] = useState<Record<string, string>>({});
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
  const handleGenerateInvite = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setGenerateError('Please enter student first and last name.');
      return;
    }
    if (!inviteGameId) {
      setGenerateError('Please select a game.');
      return;
    }

    setGenerateError(null);
    startGenerating(async () => {
      try {
        const result = await createPlayerInvite({
          schoolId: activeSchool.schoolId,
          gameId: inviteGameId,
          intendedFirstName: firstName.trim(),
          intendedLastName: lastName.trim(),
          expiresInDays: expiryDays,
        });

        const fullUrl = window.location.origin + result.inviteUrl;
        setGeneratedInvite({
          url: fullUrl,
          studentName: `${result.intendedFirstName} ${result.intendedLastName}`,
          expiresAt: result.expiresAt,
        });

        // Prepend to invites table
        const game = games.find((g) => g.id === inviteGameId);
        const newInviteItem: SchoolInviteItem = {
          id: result.inviteId,
          schoolId: activeSchool.schoolId,
          gameId: inviteGameId,
          intendedFirstName: result.intendedFirstName,
          intendedLastName: result.intendedLastName,
          status: 'pending',
          expiresAt: result.expiresAt,
          submittedAt: null,
          reviewedAt: null,
          rejectionReason: null,
          createdAt: new Date(),
          schoolSlug: activeSchool.schoolSlug,
          gameSlug: game?.slug || '',
          gameName: game?.displayName || '',
        };
        setInvites((prev) => [newInviteItem, ...prev]);

        // Auto copy to clipboard
        try {
          await navigator.clipboard.writeText(fullUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 3000);
        } catch {
          // Clipboard write failed gracefully
        }

        // Reset form inputs
        setFirstName('');
        setLastName('');
      } catch (err: any) {
        setGenerateError(err.message || 'Failed to create invite link');
      }
    });
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Clipboard write failed gracefully
    }
  };

  const handleApprove = async (inviteId: string) => {
    setApprovingId(inviteId);
    setApprovalFeedback(null);
    try {
      const rosterId = selectedRosterMap[inviteId];
      const result = await reviewPlayerInvite({
        inviteId,
        action: 'approve',
        rosterId,
      });

      if (result.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== inviteId));
        setInvites((prev) =>
          prev.map((inv) => (inv.id === inviteId ? { ...inv, status: 'accepted' } : inv))
        );
        setApprovalFeedback('Application approved! Player has been added to the roster pool.');
        setTimeout(() => setApprovalFeedback(null), 4000);
      }
    } catch (err: any) {
      setApprovalFeedback(`Approval failed: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (inviteId: string) => {
    setRejectingId(inviteId);
    setApprovalFeedback(null);
    try {
      const result = await reviewPlayerInvite({
        inviteId,
        action: 'reject',
        rejectionReason: rejectionReason.trim() || undefined,
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
        setRejectionReason('');
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
          // Mutate local roster representation
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-widest text-[#f4cccc]">
              School Operations
            </span>
            <span className="text-zinc-600">&bull;</span>
            <span className="text-xs text-zinc-400 font-medium">{activeSchool.schoolName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Manager Control Deck
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Issue personalized player invitations, review submitted applications, and verify tournament roster gates.
          </p>
        </div>

        {/* Zero-PII Compliance Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 self-start md:self-auto">
          <HiOutlineShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-left">
            <p className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
              Zero-PII Vault Active
            </p>
            <p className="text-[11px] text-zinc-400">NY § 2-D & FERPA Compliant</p>
          </div>
        </div>
      </div>

      {/* Game Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-800/80">
        <button
          onClick={() => setSelectedGame('all')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            selectedGame === 'all'
              ? 'bg-[#f4cccc] text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          All Games
        </button>
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setSelectedGame(g.id);
              setInviteGameId(g.id);
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedGame === g.id
                ? 'bg-[#f4cccc] text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            {g.displayName}
          </button>
        ))}
      </div>

      {/* Action Grid: Invite Generator & Approvals Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Player Invite Generator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#f4cccc]/10 text-[#f4cccc]">
                <HiOutlineUserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">Create Player Invite</h2>
                <p className="text-xs text-zinc-400">Generate a secure single-use onboarding URL</p>
              </div>
            </div>

            {generateError && (
              <div className="p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-center gap-2">
                <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
                <span>{generateError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Student First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Student Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Chen"
                    className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Game</label>
                <select
                  value={inviteGameId}
                  onChange={(e) => setInviteGameId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                >
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Link Expiration
                </label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                >
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (Standard)</option>
                  <option value={14}>14 Days</option>
                </select>
              </div>

              <Button
                onPress={handleGenerateInvite}
                isDisabled={isGenerating}
                className="w-full py-2.5 px-4 bg-[#f4cccc] hover:bg-[#e6b8b8] text-zinc-950 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <span>Generating Invite...</span>
                ) : (
                  <>
                    <HiOutlineSparkles className="w-4 h-4" />
                    <span>Generate One-Time Invite</span>
                  </>
                )}
              </Button>
            </div>

            {/* Generated Link Box */}
            {generatedInvite && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-[#f4cccc]/30 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#f4cccc]">
                    Invite for {generatedInvite.studentName}
                  </span>
                  <span className="text-zinc-500">
                    Expires {new Date(generatedInvite.expiresAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInvite.url}
                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 font-mono select-all focus:outline-none"
                  />
                  <Button
                    onPress={() => handleCopyLink(generatedInvite.url)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <HiOutlineCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <HiOutlineClipboardDocument className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Send this link to the student. They will complete Discord OAuth and Riot verification before appearing in your approval queue.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pending Approvals Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Pending Approvals Queue</h2>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                {filteredSubmissions.length}
              </span>
            </div>
            <span className="text-xs text-zinc-500">Verified Onboarding Submissions</span>
          </div>

          {approvalFeedback && (
            <div className="p-3 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200">
              {approvalFeedback}
            </div>
          )}

          {filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
              <HiOutlineUsers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-300">No applications waiting for review</p>
              <p className="text-xs text-zinc-500 mt-1">
                When students complete their one-time onboarding link, their verified IGN and Discord handle will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((sub) => {
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

                    {/* Actions: Assign Roster + Approve / Reject */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                      {gameRosters.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400 shrink-0">Roster:</span>
                          <select
                            value={selectedRosterMap[sub.id] || gameRosters[0]?.id || ''}
                            onChange={(e) =>
                              setSelectedRosterMap((prev) => ({
                                ...prev,
                                [sub.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-white focus:outline-none"
                          >
                            {gameRosters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.division})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Adds to active player pool</span>
                      )}

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          onPress={() => handleReject(sub.id)}
                          isDisabled={isRejecting || isApproving}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 rounded-lg transition-colors cursor-pointer"
                        >
                          Reject
                        </Button>
                        <Button
                          onPress={() => handleApprove(sub.id)}
                          isDisabled={isApproving || isRejecting}
                          className="px-3.5 py-1.5 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {isApproving ? 'Approving...' : 'Approve Application'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team Roster Builder & 5-Point Live Validation Checklist */}
      <div className="space-y-5 pt-4 border-t border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Team Rosters & Eligibility Gates</h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Live 5-point verification for tournament registration (Roster size, Captain, Riot ID, Discord link, and In-Guild status).
            </p>
          </div>
        </div>

        {filteredRosters.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-sm">
            No active rosters configured for {activeSchool.schoolName}. Contact staff to seed season teams.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredRosters.map((roster) => {
              const gateResult = eligibilityResults[roster.id];
              const isEvaluating = evaluatingRosterId === roster.id;

              return (
                <div
                  key={roster.id}
                  className="p-5 sm:p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-lg space-y-4"
                >
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
                        onPress={() => handleOpenSwapModal(roster)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <HiOutlineArrowsRightLeft className="w-3.5 h-3.5 text-amber-400" />
                        <span>Emergency Sub</span>
                      </Button>
                      <Button
                        onPress={() => handleCheckRosterGate(roster.id)}
                        isDisabled={isEvaluating}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#f4cccc] hover:bg-[#e6b8b8] text-zinc-950 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isEvaluating ? 'Evaluating...' : 'Run Roster Gate'}
                      </Button>
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
                          <th className="pb-2 font-semibold text-right">In Server</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {roster.players.map((p) => (
                          <tr key={p.id} className="hover:bg-zinc-800/20">
                            <td className="py-2.5 font-medium text-white">{p.playerName}</td>
                            <td className="py-2.5">
                              {p.isCaptain || p.role === 'captain' ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                                  Captain
                                </span>
                              ) : p.role === 'sub' ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-zinc-800 text-zinc-400">
                                  Sub
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/30">
                                  Starter
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 font-mono text-zinc-300">{p.ign}</td>
                            <td className="py-2.5 font-mono text-zinc-400">{p.discordUsername}</td>
                            <td className="py-2.5 text-right">
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
                          </tr>
                        ))}
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
            })}
          </div>
        )}
      </div>

      {/* Invites Sent Table */}
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Issued Player Invitations</h2>
          <span className="text-xs text-zinc-500">{filteredInvites.length} Total Invites</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-950/60">
                <th className="py-3 px-4 font-semibold">Intended Student</th>
                <th className="py-3 px-4 font-semibold">Game</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Created</th>
                <th className="py-3 px-4 font-semibold">Expires</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filteredInvites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    No invites generated yet. Use the generator above to create one.
                  </td>
                </tr>
              ) : (
                filteredInvites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-800/20">
                    <td className="py-3 px-4 font-medium text-white">
                      {inv.intendedFirstName} {inv.intendedLastName}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{inv.gameName}</td>
                    <td className="py-3 px-4">
                      {inv.status === 'accepted' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                          Accepted
                        </span>
                      ) : inv.status === 'submitted' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          Submitted
                        </span>
                      ) : inv.status === 'rejected' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20">
                          Rejected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        onPress={() => {
                          const url = `${window.location.origin}/join/${inv.schoolSlug}/${inv.gameSlug}`;
                          handleCopyLink(url);
                        }}
                        aria-label="Copy Base Join URL"
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <HiOutlineClipboardDocument className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Emergency Sub Swap Modal */}
      {activeSwapRoster && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400">
                  <HiOutlineArrowsRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Match-Day Emergency Sub</h3>
                  <p className="text-xs text-zinc-400">{activeSwapRoster.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSwapRoster(null)}
                className="text-zinc-500 hover:text-zinc-300"
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
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Starter / Captain to Bench (Swap Out)
                </label>
                <select
                  value={outPlayerId}
                  onChange={(e) => setOutPlayerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                >
                  {activeSwapRoster.players
                    .filter((p) => p.role === 'player' || p.role === 'captain' || p.isCaptain)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.playerName} ({p.ign}) {p.isCaptain ? '★ Captain' : 'Starter'}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Substitute to Activate (Swap In)
                </label>
                <select
                  value={inPlayerId}
                  onChange={(e) => setInPlayerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#f4cccc]"
                >
                  {activeSwapRoster.players
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
                onPress={() => setActiveSwapRoster(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onPress={handleConfirmSwap}
                isDisabled={isSwapping}
                className="px-4 py-2 text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                {isSwapping ? 'Swapping...' : 'Confirm Emergency Swap'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
