'use client';

import { useState } from 'react';
import { Button } from 'react-aria-components';
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineEye,
  HiOutlineLockClosed,
  HiOutlinePlus,
} from 'react-icons/hi2';
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
  /** Games whose season is inactive: view only, all write controls disabled (spec-028). */
  viewOnlyGameIds?: string[];
  /** Inactive season name(s) for the view-only banner. */
  viewOnlySeasonLabel?: string;
  /** Every game id shown in the portal, to tell when creation is locked everywhere. */
  allGameIds?: string[];
  eligibilityResults: Record<string, RosterEligibilityResult>;
  evaluatingRosterId: string | null;
  onOpenCreateRosterModal: () => void;
  onOpenEnrollModal: (roster: SchoolRosterDetails) => void;
  onCheckRosterGate: (rosterId: string) => void;
  onUpdateRole: (
    rosterId: string,
    playerId: string,
    role: 'player' | 'sub' | 'captain'
  ) => void;
  onRemovePlayer: (rosterId: string, playerId: string) => void;
  onMovePlayer?: (fromRosterId: string, playerId: string, toRosterId: string) => void;
  movingPlayerId?: string | null;
  /** Outcome of the last Move, rendered in a live region. */
  notice?: { kind: 'success' | 'error'; text: string } | null;
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
  onCheckRosterGate,
  onUpdateRole,
  onRemovePlayer,
  onMovePlayer,
  movingPlayerId = null,
  notice = null,
  onDeleteRoster,
}: RostersSectionProps) {
  const anyLocked = lockedGameIds.length > 0;
  // Creating is only pointless when every visible game is locked; otherwise the modal offers
  // just the unlocked games.
  const anyViewOnly = viewOnlyGameIds.length > 0;
  const createLocked =
    (anyLocked || anyViewOnly) &&
    allGameIds.every((id) => lockedGameIds.includes(id) || viewOnlyGameIds.includes(id));
  // One titled section per season, in the order the rosters arrive, so a staff view stays readable.
  // Within a season Varsity sits on the left and JV on the right.
  const divisionRank = (division: string) => (division === 'JV' || division === 'Junior Varsity' ? 1 : 0);
  const seasons = new Map<string, { name: string; rosters: SchoolRosterDetails[] }>();
  for (const roster of [...rosters].sort((a, b) => divisionRank(a.division) - divisionRank(b.division))) {
    const group = seasons.get(roster.seasonId) ?? { name: roster.seasonName, rosters: [] };
    group.rosters.push(roster);
    seasons.set(roster.seasonId, group);
  }
  // Season names are "YYYY-YY", so sorting them descending puts the most recent season first.
  const seasonGroups = [...seasons.entries()].sort(([, a], [, b]) => b.name.localeCompare(a.name));
  // Seasons the user has folded away; every season starts expanded.
  const [collapsedSeasons, setCollapsedSeasons] = useState<string[]>([]);
  const toggleSeason = (seasonId: string) =>
    setCollapsedSeasons((prev) =>
      prev.includes(seasonId) ? prev.filter((id) => id !== seasonId) : [...prev, seasonId]
    );
  return (
    <div data-tour="rosters" className="min-w-0 space-y-5 pt-4 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">Team Rosters & Eligibility Gates</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Check each roster before tournament registration.</p>
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
              You are viewing {viewOnlySeasonLabel || 'an inactive season'}. This season is inactive, so it is view only.
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
            removed, moved, swapped or re-roled, and rosters cannot be created or deleted. Contact an admin
            to request changes. You can still view rosters and check eligibility.
          </p>
        </div>
      )}

      {/* Always mounted so screen readers register the region before its text changes. */}
      <div role="status" aria-live="polite" className={notice ? '' : 'sr-only'}>
        {notice && (
          <p
            className={`rounded-xl border p-3 text-xs ${
              notice.kind === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>

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
        seasonGroups.map(([seasonId, group]) => {
          const expanded = !collapsedSeasons.includes(seasonId);
          const panelId = `season-rosters-${seasonId}`;
          return (
          <section key={seasonId} aria-label={`${group.name} season rosters`} className="space-y-4">
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleSeason(seasonId)}
                className="flex w-full items-center justify-between gap-3 text-left cursor-pointer min-h-[44px] sm:min-h-0"
              >
                <span className="text-base font-bold text-white">
                  {group.name} Season
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {group.rosters.length} {group.rosters.length === 1 ? 'roster' : 'rosters'}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-zinc-300">
                  {expanded ? 'Hide' : 'Show'}
                  {expanded ? (
                    <HiOutlineChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <HiOutlineChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </span>
              </button>
            </h3>
            {expanded && (
            <div id={panelId} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {group.rosters.map((roster) => (
                <RosterCard
                  key={roster.id}
                  roster={roster}
                  locked={lockedGameIds.includes(roster.gameId) || viewOnlyGameIds.includes(roster.gameId)}
                  gateResult={eligibilityResults[roster.id]}
                  isEvaluating={evaluatingRosterId === roster.id}
                  onOpenEnrollModal={onOpenEnrollModal}
                  onCheckRosterGate={onCheckRosterGate}
                  onUpdateRole={onUpdateRole}
                  onRemovePlayer={onRemovePlayer}
                  onMovePlayer={onMovePlayer}
                  movingPlayerId={movingPlayerId}
                  siblingRosters={rosters
                    .filter((r) => r.teamId === roster.teamId && r.id !== roster.id)
                    .map((r) => ({
                      id: r.id,
                      name: r.name,
                      playerCount: r.players.length,
                      subCount: r.players.filter((p) => p.role === 'sub').length,
                    }))}
                  onDeleteRoster={onDeleteRoster}
                />
              ))}
            </div>
            )}
          </section>
          );
        })
      )}
    </div>
  );
}
