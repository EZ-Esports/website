'use client';

import { Button } from 'react-aria-components';
import { HiOutlineEye, HiOutlineLockClosed, HiOutlinePlus } from 'react-icons/hi2';
import type {
  SchoolRosterDetails,
  RosterEligibilityResult,
} from '@/app/lib/onboarding/portal-actions';
import { RosterCard } from './RosterCard';

interface RostersSectionProps {
  rosters: SchoolRosterDetails[];
  schoolName: string;
  /** Games whose season rosters staff have locked. */
  lockedGameIds?: string[];
  /** Locked season name(s) for the banner. */
  lockedSeasonLabel?: string;
  /** Games whose season is a past season: view only, all write controls disabled (spec-028). */
  viewOnlyGameIds?: string[];
  /** Past season name(s) for the view-only banner. */
  viewOnlySeasonLabel?: string;
  /** Every game id shown in the portal, to tell when creation is locked everywhere. */
  allGameIds?: string[];
  eligibilityResults: Record<string, RosterEligibilityResult>;
  evaluatingRosterId: string | null;
  onOpenCreateRosterModal: () => void;
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

export function RostersSection({
  rosters,
  schoolName,
  lockedGameIds = [],
  lockedSeasonLabel = '',
  viewOnlyGameIds = [],
  viewOnlySeasonLabel = '',
  allGameIds = [],
  eligibilityResults,
  evaluatingRosterId,
  onOpenCreateRosterModal,
  onOpenEnrollModal,
  onOpenSwapModal,
  onCheckRosterGate,
  onUpdateRole,
  onRemovePlayer,
  onDeleteRoster,
}: RostersSectionProps) {
  const anyLocked = lockedGameIds.length > 0;
  // Creating is only pointless when every visible game is locked; otherwise the modal offers
  // just the unlocked games.
  const anyViewOnly = viewOnlyGameIds.length > 0;
  const createLocked =
    (anyLocked || anyViewOnly) &&
    allGameIds.every((id) => lockedGameIds.includes(id) || viewOnlyGameIds.includes(id));
  return (
    <div data-tour="rosters" className="min-w-0 space-y-5 pt-4 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">Team Rosters & Eligibility Gates</h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Live 5-point verification for tournament registration (Roster size, Captain, Riot ID, Discord link, and In-Guild status).
          </p>
        </div>
        <Button
          data-tour="create-roster"
          onPress={onOpenCreateRosterModal}
          isDisabled={createLocked}
          className="self-start sm:self-auto min-h-[44px] sm:min-h-0 px-3.5 py-1.5 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HiOutlinePlus className="w-4 h-4" />
          <span>Create Roster</span>
        </Button>
      </div>

      {anyViewOnly && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200"
        >
          <HiOutlineEye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-bold">
              You are viewing {viewOnlySeasonLabel || 'a past season'}. This is a past season, so it is view only.
            </span>{' '}
            Players cannot be enrolled, removed, swapped or re-roled, rosters cannot be created or
            deleted, and invites cannot be created or reviewed. You can still view rosters and check
            eligibility.
          </p>
        </div>
      )}

      {anyLocked && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200"
        >
          <HiOutlineLockClosed className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-bold">Rosters locked{lockedSeasonLabel ? ` for ${lockedSeasonLabel}` : ''}.</span>{' '}
            EZ Esports staff have locked rosters for this season, so players cannot be enrolled,
            removed, swapped or re-roled, and rosters cannot be created or deleted. Contact an admin
            to request changes. You can still view rosters and check eligibility.
          </p>
        </div>
      )}

      {rosters.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-sm space-y-3">
          <p>No active rosters configured for {schoolName}.</p>
          <Button
            onPress={onOpenCreateRosterModal}
            isDisabled={createLocked}
            className="disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <HiOutlinePlus className="w-4 h-4" />
            <span>Create First Roster</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {rosters.map((roster) => (
            <RosterCard
              key={roster.id}
              roster={roster}
              locked={lockedGameIds.includes(roster.gameId) || viewOnlyGameIds.includes(roster.gameId)}
              gateResult={eligibilityResults[roster.id]}
              isEvaluating={evaluatingRosterId === roster.id}
              onOpenEnrollModal={onOpenEnrollModal}
              onOpenSwapModal={onOpenSwapModal}
              onCheckRosterGate={onCheckRosterGate}
              onUpdateRole={onUpdateRole}
              onRemovePlayer={onRemovePlayer}
              onDeleteRoster={onDeleteRoster}
            />
          ))}
        </div>
      )}
    </div>
  );
}
