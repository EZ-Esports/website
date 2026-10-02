'use client';

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
  onOpenEnrollModal: (roster: SchoolRosterDetails) => void;
  onOpenSwapModal: (roster: SchoolRosterDetails) => void;
  onCheckRosterGate: (rosterId: string) => void;
  onUpdateRole: (
    rosterId: string,
    playerId: string,
    role: 'player' | 'sub' | 'captain'
  ) => void;
  onRemovePlayer: (rosterId: string, playerId: string) => void;
}

export function RostersSection({
  rosters,
  schoolName,
  eligibilityResults,
  evaluatingRosterId,
  onOpenEnrollModal,
  onOpenSwapModal,
  onCheckRosterGate,
  onUpdateRole,
  onRemovePlayer,
}: RostersSectionProps) {
  return (
    <div className="space-y-5 pt-4 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Team Rosters & Eligibility Gates</h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Live 5-point verification for tournament registration (Roster size, Captain, Riot ID, Discord link, and In-Guild status).
          </p>
        </div>
      </div>

      {rosters.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-sm">
          No active rosters configured for {schoolName}. Contact staff to seed season teams.
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
