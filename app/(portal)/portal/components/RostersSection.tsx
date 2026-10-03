'use client';

import { Button } from 'react-aria-components';
import { HiOutlinePlus } from 'react-icons/hi2';
import type {
  SchoolRosterDetails,
  RosterEligibilityResult,
} from '@/app/lib/onboarding/portal-actions';
import { RosterCard } from './RosterCard';

interface RostersSectionProps {
  rosters: SchoolRosterDetails[];
  schoolName: string;
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
  return (
    <div className="space-y-5 pt-4 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Team Rosters & Eligibility Gates</h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Live 5-point verification for tournament registration (Roster size, Captain, Riot ID, Discord link, and In-Guild status).
          </p>
        </div>
        <Button
          onPress={onOpenCreateRosterModal}
          className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <HiOutlinePlus className="w-4 h-4" />
          <span>Create Roster</span>
        </Button>
      </div>

      {rosters.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-sm space-y-3">
          <p>No active rosters configured for {schoolName}.</p>
          <Button
            onPress={onOpenCreateRosterModal}
            className="px-4 py-2 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
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
