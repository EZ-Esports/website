'use client';

import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { formatNY } from '@/app/lib/dates';
import {
  schoolMatchStatusLabel,
  splitSchoolMatches,
  type SchoolMatchItem,
} from '@/app/lib/school-matches';
import { RescheduleCell } from './RescheduleControls';

interface MatchesSectionProps {
  matches: SchoolMatchItem[];
  /** The school whose portal is open: the side that requests, responds or cancels reschedules. */
  schoolId: string;
  /** Games whose season is inactive for this manager: reschedule actions are hidden. */
  viewOnlyGameIds: string[];
  /** Server clock (ISO). The Upcoming/Past split and status labels must not depend on the browser clock. */
  nowIso: string;
  /** Show the Game column when the list spans more than one game. */
  showGame: boolean;
}

const TAB_CLASS =
  'min-h-[44px] px-4 flex items-center text-sm font-semibold cursor-pointer outline-none ' +
  'text-zinc-500 border-b-2 border-transparent transition-colors ' +
  'data-[hovered]:text-zinc-300 data-[selected]:text-white data-[selected]:border-accent ' +
  'data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-accent';

// The panel holds no focusable child, so RAC makes it a tab stop (and the keyboard route to a
// horizontally scrolling table): it needs a visible focus ring.
const PANEL_CLASS =
  'pt-4 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent rounded-xl';

function resultLabel(match: SchoolMatchItem): string | null {
  if (match.ownScore === null || match.opponentScore === null) return null;
  const outcome =
    match.ownScore > match.opponentScore ? 'W' : match.ownScore < match.opponentScore ? 'L' : 'D';
  return `${outcome} ${match.ownScore}–${match.opponentScore}`;
}

function MatchTable({
  matches,
  now,
  showGame,
  showSeason,
  showResult,
  showReschedule,
  schoolId,
  viewOnlyGameIds,
  emptyText,
}: {
  matches: SchoolMatchItem[];
  now: Date;
  showGame: boolean;
  showSeason: boolean;
  showResult: boolean;
  showReschedule: boolean;
  schoolId: string;
  viewOnlyGameIds: string[];
  emptyText: string;
}) {
  const columns = 4 + (showGame ? 1 : 0) + (showResult ? 1 : 0) + (showReschedule ? 1 : 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
      <table className={`w-full text-left text-xs ${showReschedule ? 'min-w-[44rem]' : 'min-w-[34rem]'}`}>
        <thead>
          <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-950/60">
            <th className="py-3 px-4 font-semibold">When</th>
            <th className="py-3 px-4 font-semibold">Opponent</th>
            <th className="py-3 px-4 font-semibold">Division</th>
            {showGame && <th className="py-3 px-4 font-semibold">Game</th>}
            <th className="py-3 px-4 font-semibold">Status</th>
            {showResult && <th className="py-3 px-4 font-semibold">Result</th>}
            {showReschedule && <th className="py-3 px-4 font-semibold">Reschedule</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {matches.length === 0 ? (
            <tr>
              <td colSpan={columns} className="py-6 text-center text-zinc-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            matches.map((match) => {
              const when = new Date(match.scheduledAt);
              const result = resultLabel(match);
              return (
                <tr key={match.id} className="hover:bg-zinc-800/20">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium text-white">{formatNY(when, 'date-short')}</div>
                    <div className="text-zinc-400">{formatNY(when, 'time')}</div>
                  </td>
                  <td className="py-3 px-4 text-zinc-200">
                    <span className="font-medium text-white">{match.opponentName}</span>
                    <span className="ml-2 text-zinc-500">{match.isHome ? 'Home' : 'Away'}</span>
                  </td>
                  <td className="py-3 px-4 text-zinc-300">
                    {match.division}
                    {showSeason && <div className="text-zinc-500">{match.seasonName}</div>}
                  </td>
                  {showGame && <td className="py-3 px-4 text-zinc-300">{match.gameName}</td>}
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                      {schoolMatchStatusLabel(match, now)}
                    </span>
                  </td>
                  {showResult && (
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">{result ?? '—'}</td>
                  )}
                  {showReschedule && (
                    <td className="py-3 px-4 align-top">
                      <RescheduleCell
                        match={match}
                        schoolId={schoolId}
                        now={now}
                        viewOnly={viewOnlyGameIds.includes(match.gameId)}
                      />
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function MatchesSection({
  matches,
  schoolId,
  viewOnlyGameIds,
  nowIso,
  showGame,
}: MatchesSectionProps) {
  const now = new Date(nowIso);
  const { upcoming, past } = splitSchoolMatches(matches, now);
  // Only a staff admin's list can span seasons; a manager works in one season per game.
  const showSeason = new Set(matches.map((m) => `${m.gameId}|${m.seasonName}`)).size >
    new Set(matches.map((m) => m.gameId)).size;

  return (
    <section className="space-y-4 pt-4 border-t border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-white">Matches</h2>
        <span className="text-xs text-zinc-500">All times Eastern (ET)</span>
      </div>

      <Tabs>
        <TabList
          aria-label="Matches"
          className="flex overflow-x-auto border-b border-zinc-800"
        >
          <Tab id="upcoming" className={TAB_CLASS}>
            Upcoming ({upcoming.length})
          </Tab>
          <Tab id="past" className={TAB_CLASS}>
            Past ({past.length})
          </Tab>
        </TabList>
        <TabPanel id="upcoming" className={PANEL_CLASS}>
          <MatchTable
            matches={upcoming}
            now={now}
            showGame={showGame}
            showSeason={showSeason}
            showResult={false}
            showReschedule
            schoolId={schoolId}
            viewOnlyGameIds={viewOnlyGameIds}
            emptyText="No upcoming matches are scheduled yet."
          />
        </TabPanel>
        <TabPanel id="past" className={PANEL_CLASS}>
          <MatchTable
            matches={past}
            now={now}
            showGame={showGame}
            showSeason={showSeason}
            showResult
            showReschedule={false}
            schoolId={schoolId}
            viewOnlyGameIds={viewOnlyGameIds}
            emptyText="No past matches yet."
          />
        </TabPanel>
      </Tabs>
    </section>
  );
}
