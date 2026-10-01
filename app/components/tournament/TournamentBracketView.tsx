'use client';

import { useState } from 'react';
import type { TournamentSeasonStructure, BracketMatch } from '@/app/lib/bracket';
import { BracketNode, BracketMatchModal } from './BracketNode';
import { Table, Th, Td, Tr } from '@/app/components/ui/Table';

interface TournamentBracketViewProps {
  structure: TournamentSeasonStructure;
}

export default function TournamentBracketView({
  structure,
}: TournamentBracketViewProps) {
  // Determine available tabs
  const tabs: { id: string; label: string }[] = [];

  // Stage tabs
  for (const stage of structure.stages) {
    tabs.push({ id: `stage-${stage.stage}`, label: stage.label });
  }

  // Group tabs
  for (let i = 0; i < structure.groups.length; i++) {
    const group = structure.groups[i];
    tabs.push({ id: `group-${i}`, label: group.name });
  }

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || '');
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);

  if (tabs.length === 0) {
    return (
      <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
        No tournament bracket or matches recorded for this season yet.
      </div>
    );
  }

  // Active stage or group
  const activeStage = structure.stages.find((s) => `stage-${s.stage}` === activeTabId);
  const activeGroup = structure.groups.find((_, i) => `group-${i}` === activeTabId);

  return (
    <div className="space-y-8">
      {/* Stage / Group Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line/60 pb-4">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-accent text-white shadow-md shadow-accent/20'
                  : 'bg-surface-raised/60 text-foreground-secondary hover:text-foreground hover:bg-surface-raised border border-line/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Bracket Rounds View */}
      {activeStage && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              {activeStage.label}
            </h3>
            <span className="text-xs text-foreground-muted font-bold">
              {activeStage.rounds.reduce((acc, r) => acc + r.matches.length, 0)} Matches
            </span>
          </div>

          {/* Horizontal scrollable rounds layout */}
          <div className="overflow-x-auto pb-6 pt-2 no-scrollbar">
            <div className="flex items-start gap-8 min-w-max px-1">
              {activeStage.rounds.map((round) => (
                <div key={round.name} className="flex flex-col gap-4">
                  {/* Round Header */}
                  <div className="bg-surface-raised/80 border border-line rounded-xl px-4 py-2 text-center shadow-sm">
                    <span className="text-xs font-black uppercase tracking-wider text-foreground">
                      {round.name}
                    </span>
                    <span className="block text-[10px] text-foreground-muted font-bold mt-0.5">
                      {round.matches.length} {round.matches.length === 1 ? 'Match' : 'Matches'}
                    </span>
                  </div>

                  {/* Matches Column with Vertical Spacing */}
                  <div className="flex flex-col justify-around gap-6">
                    {round.matches.map((m) => (
                      <BracketNode
                        key={m.id}
                        match={m}
                        onSelect={(match) => setSelectedMatch(match)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Group Stage Table & Matches View */}
      {activeGroup && (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg md:text-xl font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              {activeGroup.name} Standings
            </h3>
            <div className="bg-surface-raised/60 border border-line rounded-2xl overflow-hidden shadow-xl shadow-black/20">
              <Table>
                <thead>
                  <Tr>
                    <Th className="w-12 text-center">#</Th>
                    <Th>Participant</Th>
                    <Th className="text-center w-16">P</Th>
                    <Th className="text-center w-16">W</Th>
                    <Th className="text-center w-16">L</Th>
                    <Th className="text-center w-16">PTS</Th>
                  </Tr>
                </thead>
                <tbody>
                  {activeGroup.standings.map((row, idx) => (
                    <Tr key={row.name}>
                      <Td className="text-center font-bold">{idx + 1}</Td>
                      <Td>
                        <div className="font-black text-foreground">{row.name}</div>
                        <div className="text-[11px] text-foreground-muted">{row.schoolName}</div>
                      </Td>
                      <Td className="text-center font-bold tabular-nums">{row.played}</Td>
                      <Td className="text-center font-bold text-accent tabular-nums">{row.wins}</Td>
                      <Td className="text-center font-bold text-foreground-muted tabular-nums">{row.losses}</Td>
                      <Td className="text-center font-black text-foreground tabular-nums">{row.points}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="text-lg md:text-xl font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              {activeGroup.name} Fixtures & Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGroup.matches.map((m) => (
                <BracketNode
                  key={m.id}
                  match={m}
                  onSelect={(match) => setSelectedMatch(match)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Match Details Modal */}
      <BracketMatchModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}
