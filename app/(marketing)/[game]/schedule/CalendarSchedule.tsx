'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiX, FiInfo } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNY } from '@/app/lib/dates';
import Badge from '@/app/components/ui/Badge';

interface ScheduleItem {
  id: string;
  ts: number;
  date: string;
  time: string;
  scheduledAt: string;
  team1: string;
  team2: string;
  division: string;
  status: string;
  result?: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface CalendarScheduleProps {
  matches: ScheduleItem[];
  gameSlug: string;
  division: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// NY-timezone formatting is shared league-wide; see app/lib/dates.ts.

// Helper to determine initial calendar focus based on matches list
function getInitialDate(matches: ScheduleItem[]) {
  const upcoming = matches.filter(m => m.status !== 'Completed');
  if (upcoming.length > 0) {
    const sorted = [...upcoming].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return new Date(sorted[0].scheduledAt);
  }
  if (matches.length > 0) {
    const sorted = [...matches].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    return new Date(sorted[0].scheduledAt);
  }
  return new Date();
}

export default function CalendarSchedule({ matches, gameSlug, division }: CalendarScheduleProps) {
  // Pre-process matches once to map them to America/New_York YYYY-MM-DD
  const processedMatches = useMemo(() => {
    return matches.map(m => {
      const dateObj = new Date(m.scheduledAt);
      const ymd = formatNY(dateObj, 'ymd');
      return {
        ...m,
        ymd,
        formattedDate: formatNY(dateObj, 'date-long'),
        formattedTime: formatNY(dateObj, 'time'),
      };
    });
  }, [matches]);

  const [currentMonth, setCurrentMonth] = useState(() => getInitialDate(matches).getMonth());
  const [currentYear, setCurrentYear] = useState(() => getInitialDate(matches).getFullYear());
  const [selectedDateYmd, setSelectedDateYmd] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<typeof processedMatches[0] | null>(null);

  // Calendar Grid Calculation
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  const calendarCells = useMemo(() => {
    const cells = [];

    // Padding days from previous month
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const ymdStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        day,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        ymd: ymdStr,
      });
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const ymdStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        day,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        ymd: ymdStr,
      });
    }

    // Pad end of month to draw a full grid
    const totalCells = cells.length > 35 ? 42 : 35;
    const paddingNext = totalCells - cells.length;
    for (let day = 1; day <= paddingNext; day++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const ymdStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        day,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        ymd: ymdStr,
      });
    }

    return cells;
  }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek]);

  // Match Lookup mapping for dates
  const matchMapByDate = useMemo(() => {
    const map = new Map<string, typeof processedMatches>();
    processedMatches.forEach(m => {
      const existing = map.get(m.ymd) || [];
      existing.push(m);
      map.set(m.ymd, existing);
    });
    return map;
  }, [processedMatches]);

  // Filtered list of matches to show below the calendar
  const activeMonthMatches = useMemo(() => {
    return processedMatches.filter(m => {
      const d = new Date(m.scheduledAt);
      // Compare in NY timezone context
      const matchMonth = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'numeric' });
      const matchYear = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric' });
      return Number(matchMonth) - 1 === currentMonth && Number(matchYear) === currentYear;
    }).sort((a, b) => a.ts - b.ts);
  }, [processedMatches, currentMonth, currentYear]);

  // Matches for the selected date
  const selectedDateMatches = useMemo(() => {
    if (!selectedDateYmd) return [];
    return matchMapByDate.get(selectedDateYmd) || [];
  }, [selectedDateYmd, matchMapByDate]);

  // Handlers for switching months
  const handlePrevMonth = () => {
    setSelectedDateYmd(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDateYmd(null);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const todayYmd = useMemo(() => {
    return formatNY(new Date(), 'ymd');
  }, []);

  return (
    <div className="space-y-8 select-none">
      {/* Calendar Interface */}
      <div className="bg-surface-sunken/40 border border-line rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-2xl">

        {/* Switcher & Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2.5 rounded-xl bg-surface-raised border border-line text-foreground-secondary hover:text-foreground hover:border-accent/60 transition-all active:scale-95 cursor-pointer"
              aria-label="Previous month"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl md:text-2xl font-black text-foreground min-w-[170px] text-center tracking-tight uppercase">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2.5 rounded-xl bg-surface-raised border border-line text-foreground-secondary hover:text-foreground hover:border-accent/60 transition-all active:scale-95 cursor-pointer"
              aria-label="Next month"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-xs text-foreground-secondary font-semibold bg-surface-raised/50 border border-line/60 rounded-xl px-4 py-2 flex items-center gap-2">
            <FiInfo className="text-accent shrink-0 w-4 h-4" />
            <span>Timezone: EST/EDT. Click dates to filter matches.</span>
          </div>
        </div>

        {/* Calendar Grid Weekdays */}
        <div className="grid grid-cols-7 gap-1 md:gap-3 mb-2 text-center">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-foreground-muted font-extrabold text-xs tracking-wider uppercase py-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-3">
          {calendarCells.map((cell, index) => {
            const cellMatches = matchMapByDate.get(cell.ymd) || [];
            const hasMatches = cellMatches.length > 0;
            const isToday = cell.ymd === todayYmd;
            const isSelected = cell.ymd === selectedDateYmd;

            // Highlight border if selected, today, or has matches
            let borderClass = 'border-line/60';
            let bgClass = 'bg-surface-sunken/20';

            if (cell.isCurrentMonth) {
              if (isSelected) {
                borderClass = 'border-accent bg-accent/5 shadow-[0_0_15px] shadow-accent/10 z-10';
              } else if (isToday) {
                borderClass = 'border-foreground-muted bg-surface-raised/30';
              } else if (hasMatches) {
                borderClass = 'border-line hover:border-foreground-muted/40 hover:bg-surface-raised/40';
              } else {
                borderClass = 'border-line/40 hover:border-line hover:bg-surface-raised/20';
              }
            } else {
              // Outside month days
              borderClass = 'border-transparent opacity-20 pointer-events-none';
              bgClass = 'bg-transparent';
            }

            return (
              <div
                key={index}
                onClick={() => cell.isCurrentMonth && setSelectedDateYmd(isSelected ? null : cell.ymd)}
                className={`min-h-[55px] md:min-h-[110px] rounded-xl border p-1 md:p-2.5 flex flex-col justify-between transition-all duration-300 relative select-none ${
                  cell.isCurrentMonth ? 'cursor-pointer' : ''
                } ${borderClass} ${bgClass}`}
              >
                {/* Cell Header: Day Number */}
                <div className="flex justify-between items-start">
                  {isToday && cell.isCurrentMonth && (
                    <span className="hidden md:inline-block text-[9px] font-black uppercase tracking-wider text-foreground-secondary bg-surface-raised border border-line/50 rounded px-1.5 py-0.5">
                      Today
                    </span>
                  )}
                  <div className={`ml-auto text-xs md:text-sm font-black ${
                    cell.isCurrentMonth
                      ? isSelected
                        ? 'text-accent'
                        : isToday
                        ? 'text-foreground'
                        : 'text-foreground-secondary'
                      : 'text-foreground-muted'
                  }`}>
                    {cell.day}
                  </div>
                </div>

                {/* Cell Matches (Desktop View) */}
                <div className="hidden md:flex flex-col gap-1 mt-1.5 overflow-hidden">
                  {cellMatches.slice(0, 2).map((m) => {
                    const isLive = m.status === 'Live';
                    const isCompleted = m.status === 'Completed';

                    let badgeClass = 'bg-accent/5 border-accent/20 text-foreground-secondary hover:text-accent hover:bg-accent/10 hover:border-accent/40';
                    if (isLive) {
                      badgeClass = 'bg-success/10 border-success/30 text-success animate-pulse';
                    } else if (isCompleted) {
                      badgeClass = 'bg-surface-raised border-line text-foreground-secondary';
                    }

                    return (
                      <button
                        key={m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMatch(m);
                        }}
                        className={`text-[10px] font-bold px-2 py-1 rounded border truncate text-left w-full transition-all duration-200 cursor-pointer ${badgeClass}`}
                      >
                        {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-success mr-1 animate-ping" />}
                        {m.team1} vs {m.team2}
                      </button>
                    );
                  })}
                  {cellMatches.length > 2 && (
                    <div className="text-[9px] font-bold text-foreground-muted pl-1">
                      + {cellMatches.length - 2} more
                    </div>
                  )}
                </div>

                {/* Cell Indicators (Mobile View - Dots instead of list tags) */}
                {hasMatches && cell.isCurrentMonth && (
                  <div className="md:hidden flex justify-center gap-1 mt-1">
                    {cellMatches.slice(0, 3).map((m) => {
                      let dotColor = 'bg-accent shadow-[0_0_6px] shadow-accent/60';
                      if (m.status === 'Live') {
                        dotColor = 'bg-success shadow-[0_0_6px] shadow-success/60 animate-pulse';
                      } else if (m.status === 'Completed') {
                        dotColor = 'bg-foreground-muted';
                      }
                      return (
                        <span
                          key={m.id}
                          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                        />
                      );
                    })}
                    {cellMatches.length > 3 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted/50" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day's Matches OR Selected Month's Match List */}
      <div>
        <div className="flex items-center justify-between border-b border-line pb-3 mb-6">
          <h3 className="text-sm font-black uppercase tracking-wider text-foreground-secondary">
            {selectedDateYmd ? (
              <span>
                Matches on{' '}
                <span className="text-foreground">
                  {new Date(
                    Number(selectedDateYmd.split('-')[0]),
                    Number(selectedDateYmd.split('-')[1]) - 1,
                    Number(selectedDateYmd.split('-')[2])
                  ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </span>
            ) : (
              <span>Schedule for {MONTH_NAMES[currentMonth]} {currentYear}</span>
            )}
          </h3>
          {selectedDateYmd && (
            <button
              onClick={() => setSelectedDateYmd(null)}
              className="text-xs font-bold text-accent hover:text-accent/80 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-raised/60 border border-line cursor-pointer transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Match List Display */}
        {(() => {
          const listToShow = selectedDateYmd ? selectedDateMatches : activeMonthMatches;

          if (listToShow.length === 0) {
            return (
              <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
                {selectedDateYmd ? (
                  <span>No matches scheduled on this day.</span>
                ) : (
                  <span>No matches scheduled for {MONTH_NAMES[currentMonth]} {currentYear}.</span>
                )}
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listToShow.map((match) => {
                const isLive = match.status === 'Live';
                const isCompleted = match.status === 'Completed';

                let accentBorder = 'border-l-accent';
                if (isLive) {
                  accentBorder = 'border-l-success shadow-[0_0_15px] shadow-success/5';
                } else if (isCompleted) {
                  accentBorder = 'border-l-line';
                }

                return (
                  <div
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`bg-surface-raised/60 border border-line border-l-4 ${accentBorder} rounded-xl p-5 flex items-center justify-between hover:border-foreground-muted/40 hover:bg-surface-raised/80 cursor-pointer transition-all duration-300 group`}
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-foreground-secondary group-hover:text-foreground transition-colors">
                        <FiCalendar className="w-3.5 h-3.5 text-accent/70" />
                        <span>{match.formattedDate}</span>
                        <span>•</span>
                        <FiClock className="w-3.5 h-3.5 text-accent/70" />
                        <span>{match.formattedTime}</span>
                      </div>
                      <div className="text-base md:text-lg font-bold text-foreground group-hover:text-accent tracking-tight transition-colors">
                        {match.team1}{' '}
                        <span className="text-foreground-muted font-medium px-0.5">vs</span>{' '}
                        {match.team2}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isCompleted ? (
                        <div className="flex flex-col items-end gap-1">
                          {/* Unrecorded results render a neutral label, not an empty pill. */}
                          {match.result ? (
                            <Badge>{match.result}</Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">Final</Badge>
                          )}
                          {match.homeScore !== null && match.awayScore !== null && (
                            <span className="text-xs text-foreground-secondary font-bold">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          )}
                        </div>
                      ) : isLive ? (
                        <Badge variant="success" dot className="animate-pulse">
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Upcoming
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Match Details Overlay Modal */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMatch(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="bg-surface-sunken border border-line rounded-2xl w-full max-w-xl overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10"
            >
              {/* Modal Header Cover */}
              <div className="bg-gradient-to-r from-accent/15 to-transparent border-b border-line px-6 py-5 flex items-center justify-between">
                <div>
                  <Badge size="sm">{selectedMatch.division} Division</Badge>
                  <h4 className="text-lg font-black text-foreground mt-1 uppercase tracking-tight">Match Details</h4>
                </div>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="p-2 rounded-lg bg-surface-raised border border-line text-foreground-secondary hover:text-foreground hover:border-foreground-muted/40 transition-colors cursor-pointer"
                  aria-label="Close details"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">

                {/* Versus Visualizer */}
                <div className="bg-surface-raised/40 border border-line rounded-xl p-5 md:p-6 flex items-center justify-between gap-2 relative overflow-hidden">

                  {/* Glowing background highlights */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface-raised/50 via-transparent to-transparent pointer-events-none" />

                  {/* Team 1 (Home) */}
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider mb-1">Home</div>
                    <div className="text-base md:text-lg font-black text-foreground truncate px-1">
                      {selectedMatch.team1}
                    </div>
                  </div>

                  {/* VS / Score Hub */}
                  <div className="flex flex-col items-center justify-center shrink-0 min-w-[70px] z-10">
                    {selectedMatch.status === 'Completed' && selectedMatch.homeScore !== null && selectedMatch.awayScore !== null ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl md:text-3xl font-black ${selectedMatch.homeScore > selectedMatch.awayScore ? 'text-accent' : 'text-foreground-secondary'}`}>
                          {selectedMatch.homeScore}
                        </span>
                        <span className="text-foreground-muted font-extrabold text-sm">-</span>
                        <span className={`text-2xl md:text-3xl font-black ${selectedMatch.awayScore > selectedMatch.homeScore ? 'text-accent' : 'text-foreground-secondary'}`}>
                          {selectedMatch.awayScore}
                        </span>
                      </div>
                    ) : selectedMatch.status === 'Live' ? (
                      <span className="px-2.5 py-1 rounded bg-success/10 border border-success/20 text-success font-extrabold text-xs uppercase animate-pulse">
                        Live
                      </span>
                    ) : (
                      <span className="text-foreground-muted font-black text-lg italic tracking-widest">VS</span>
                    )}
                  </div>

                  {/* Team 2 (Away) */}
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider mb-1">Away</div>
                    <div className="text-base md:text-lg font-black text-foreground truncate px-1">
                      {selectedMatch.team2}
                    </div>
                  </div>
                </div>

                {/* Details List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-raised/40 border border-line rounded-xl p-4 flex items-center gap-3.5">
                    <div className="p-3 rounded-lg bg-surface-raised border border-line text-accent/80 shrink-0">
                      <FiCalendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider">Date</div>
                      <div className="text-sm font-bold text-foreground mt-0.5 leading-tight">{selectedMatch.formattedDate}</div>
                    </div>
                  </div>

                  <div className="bg-surface-raised/40 border border-line rounded-xl p-4 flex items-center gap-3.5">
                    <div className="p-3 rounded-lg bg-surface-raised border border-line text-accent/80 shrink-0">
                      <FiClock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-foreground-muted tracking-wider">Time</div>
                      <div className="text-sm font-bold text-foreground mt-0.5 leading-tight">
                        {selectedMatch.formattedTime} <span className="text-foreground-muted text-xs font-semibold">(EST)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Callout Banner */}
                <div className="bg-surface-raised/30 border border-line/60 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      selectedMatch.status === 'Completed'
                        ? 'bg-foreground-muted'
                        : selectedMatch.status === 'Live'
                        ? 'bg-success animate-pulse'
                        : 'bg-accent'
                    }`} />
                    <span className="text-xs text-foreground-secondary font-extrabold uppercase tracking-wide">
                      Match Status:{' '}
                      <span className="text-foreground">{selectedMatch.status}</span>
                    </span>
                  </div>

                  {selectedMatch.status === 'Completed' && (
                    <span className="text-xs text-foreground-secondary font-bold bg-surface-raised border border-line rounded-lg px-3 py-1">
                      Result: <span className="text-accent font-black">{selectedMatch.result?.split(' ')[0] === 'W' ? 'Completed' : 'Completed'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-surface-raised/30 border-t border-line px-6 py-4 flex items-center justify-end gap-3">
                <Link
                  href={`/${gameSlug}/standings?division=${division}`}
                  className="px-4 py-2 rounded-lg bg-surface-raised border border-line hover:border-foreground-muted/40 text-foreground-secondary hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
                  onClick={() => setSelectedMatch(null)}
                >
                  View Standings
                </Link>
                <Link
                  href={`/${gameSlug}/teams`}
                  className="px-4 py-2 rounded-lg bg-accent text-on-accent hover:bg-accent/80 text-xs font-extrabold transition-colors cursor-pointer"
                  onClick={() => setSelectedMatch(null)}
                >
                  Explore Teams
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
