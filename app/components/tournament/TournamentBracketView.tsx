'use client';

import { useState, useRef, useEffect } from 'react';
import { createBracket } from 'bracketry';
import type {
  TournamentStructure,
  TournamentStage,
  TournamentMatch,
} from '@/app/types/tournament';
import { transformStageToBracketry } from '@/app/lib/bracket';
import { BracketMatchModal, GroupFixtureCard } from './BracketMatchModal';
import { Table, Th, Td, Tr } from '@/app/components/ui/Table';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface BracketryCanvasProps {
  stage: TournamentStage;
  onSelectMatch: (match: TournamentMatch) => void;
}

function BracketryCanvas({ stage, onSelectMatch }: BracketryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { data, matchLookup } = transformStageToBracketry(stage);

    // Calculate dynamic height based on match density
    const maxMatchesInRound = Math.max(1, ...stage.rounds.map((r) => r.matches.length));
    const calculatedHeight = Math.max(480, maxMatchesInRound * 130);

    const bracketInstance = createBracket(data, containerRef.current, {
      width: '100%',
      height: `${calculatedHeight}px`,
      rootBgColor: 'transparent',
      rootBorderColor: 'transparent',
      wrapperBorderColor: 'transparent',
      connectionLinesColor: 'rgba(255, 255, 255, 0.18)',
      connectionLinesWidth: 2,
      highlightedConnectionLinesColor: '#EC3556',
      hoveredMatchBorderColor: '#EC3556',
      roundTitlesBorderColor: 'rgba(255, 255, 255, 0.1)',
      roundTitleColor: '#F8FAFC',
      matchTextColor: '#F8FAFC',
      roundTitlesFontSize: 13,
      roundTitlesVerticalPadding: 10,
      matchMaxWidth: 260,
      matchMinVerticalGap: 24,
      matchHorMargin: 36,
      useClassicalLayout: true,
      scrollButtonSvgColor: '#EC3556',
      navButtonSvgColor: '#EC3556',
      getPlayerTitleHTML: (player) => {
        const ign = player.title || 'TBD';
        const school = player.nationality || '';
        return `
          <div style="display: flex; flex-direction: column; justify-content: center; line-height: 1.25; overflow: hidden; padding-right: 6px;">
            <span style="font-weight: 700; font-size: 13px; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(ign)}
            </span>
            ${
              school
                ? `<span style="font-size: 10px; font-weight: 500; color: #94A3B8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
                    ${escapeHtml(school)}
                  </span>`
                : ''
            }
          </div>
        `;
      },
      onMatchClick: (match) => {
        if (typeof match.roundIndex === 'number' && typeof match.order === 'number') {
          const original = matchLookup.get(`${match.roundIndex}_${match.order}`);
          if (original) {
            onSelectMatch(original);
          }
        }
      },
    });

    return () => {
      try {
        bracketInstance?.uninstall();
      } catch {
        // no-op if already uninstalled
      }
    };
  }, [stage, onSelectMatch]);

  return (
    <div className="bracketry-container w-full overflow-hidden rounded-2xl border border-line bg-surface-raised/40 p-4 shadow-xl">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

interface TournamentBracketViewProps {
  structure: TournamentStructure;
}

export default function TournamentBracketView({ structure }: TournamentBracketViewProps) {
  const tabs: { id: string; label: string }[] = [];

  for (const stage of structure.stages) {
    tabs.push({ id: `stage-${stage.stage}`, label: stage.label });
  }

  for (let i = 0; i < structure.groups.length; i++) {
    const group = structure.groups[i];
    tabs.push({ id: `group-${i}`, label: group.name });
  }

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || '');
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);

  if (tabs.length === 0) {
    return (
      <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
        No tournament bracket or matches recorded for this season yet.
      </div>
    );
  }

  const activeStage = structure.stages.find((s) => `stage-${s.stage}` === activeTabId);
  const activeGroup = structure.groups.find((_, i) => `group-${i}` === activeTabId);

  return (
    <div className="space-y-8">
      {/* Global styling for bracketry matches to fit dark design tokens */}
      <style jsx global>{`
        .bracketry-container .match-body {
          background: #14161b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
          transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .bracketry-container .match-body:hover {
          border-color: #ec3556;
          box-shadow: 0 6px 20px rgba(236, 53, 86, 0.3);
          transform: translateY(-2px);
        }
        .bracketry-container .side-wrapper {
          padding: 8px 12px;
          background: #181b22;
        }
        .bracketry-container .side-wrapper:first-child {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .bracketry-container .round-titles-wrapper .round-title {
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #f8fafc;
        }
      `}</style>

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

      {/* Bracket Stage Visualization (Rendered with bracketry library) */}
      {activeStage && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              {activeStage.label}
            </h3>
            <span className="text-xs text-foreground-muted font-bold">
              {activeStage.rounds.reduce((acc, r) => acc + r.matches.length, 0)} Matches
            </span>
          </div>

          <BracketryCanvas
            stage={activeStage}
            onSelectMatch={(match) => setSelectedMatch(match)}
          />
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
                    <Tr key={row.playerTitle}>
                      <Td className="text-center font-bold">{idx + 1}</Td>
                      <Td>
                        <div className="font-black text-foreground">{row.playerTitle}</div>
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
                <GroupFixtureCard
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
