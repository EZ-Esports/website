'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiX, FiInfo } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

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

// Helper to format in NY timezone and avoid local browser time shifts
function formatInNYTimezone(date: Date, formatType: 'ymd' | 'date-str' | 'time-str') {
  if (formatType === 'ymd') {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } else if (formatType === 'date-str') {
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } else {
    return date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

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
      const ymd = formatInNYTimezone(dateObj, 'ymd');
      return {
        ...m,
        ymd,
        formattedDate: formatInNYTimezone(dateObj, 'date-str'),
        formattedTime: formatInNYTimezone(dateObj, 'time-str'),
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
    return formatInNYTimezone(new Date(), 'ymd');
  }, []);

  return (
    <div className="space-y-8 select-none">
      {/* Calendar Interface */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-2xl">
        
        {/* Switcher & Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-ez-pink/60 transition-all active:scale-95 cursor-pointer"
              aria-label="Previous month"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl md:text-2xl font-black text-white min-w-[170px] text-center tracking-tight uppercase">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-ez-pink/60 transition-all active:scale-95 cursor-pointer"
              aria-label="Next month"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-xs text-slate-400 font-semibold bg-slate-900/50 border border-slate-800/40 rounded-xl px-4 py-2 flex items-center gap-2">
            <FiInfo className="text-ez-pink shrink-0 w-4 h-4" />
            <span>Timezone: EST/EDT. Click dates to filter matches.</span>
          </div>
        </div>

        {/* Calendar Grid Weekdays */}
        <div className="grid grid-cols-7 gap-1 md:gap-3 mb-2 text-center">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-slate-500 font-extrabold text-xs tracking-wider uppercase py-1.5">
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
            let borderClass = 'border-slate-900';
            let bgClass = 'bg-slate-950/20';
            
            if (cell.isCurrentMonth) {
              if (isSelected) {
                borderClass = 'border-ez-pink bg-ez-pink/5 shadow-[0_0_15px_rgba(255,107,157,0.1)] z-10';
              } else if (isToday) {
                borderClass = 'border-slate-500 bg-slate-900/30';
              } else if (hasMatches) {
                borderClass = 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40';
              } else {
                borderClass = 'border-slate-900/60 hover:border-slate-800 hover:bg-slate-900/20';
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
                    <span className="hidden md:inline-block text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-800 border border-slate-700/50 rounded px-1.5 py-0.5">
                      Today
                    </span>
                  )}
                  <div className={`ml-auto text-xs md:text-sm font-black ${
                    cell.isCurrentMonth
                      ? isSelected
                        ? 'text-ez-pink'
                        : isToday
                        ? 'text-white'
                        : 'text-slate-400'
                      : 'text-slate-600'
                  }`}>
                    {cell.day}
                  </div>
                </div>

                {/* Cell Matches (Desktop View) */}
                <div className="hidden md:flex flex-col gap-1 mt-1.5 overflow-hidden">
                  {cellMatches.slice(0, 2).map((m) => {
                    const isLive = m.status === 'Live';
                    const isCompleted = m.status === 'Completed';

                    let badgeClass = 'bg-ez-pink/5 border-ez-pink/20 text-slate-300 hover:text-ez-pink hover:bg-ez-pink/10 hover:border-ez-pink/40';
                    if (isLive) {
                      badgeClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse';
                    } else if (isCompleted) {
                      badgeClass = 'bg-slate-900 border-slate-800/80 text-slate-400';
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
                        {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-ping" />}
                        {m.team1} vs {m.team2}
                      </button>
                    );
                  })}
                  {cellMatches.length > 2 && (
                    <div className="text-[9px] font-bold text-slate-500 pl-1">
                      + {cellMatches.length - 2} more
                    </div>
                  )}
                </div>

                {/* Cell Indicators (Mobile View - Dots instead of list tags) */}
                {hasMatches && cell.isCurrentMonth && (
                  <div className="md:hidden flex justify-center gap-1 mt-1">
                    {cellMatches.slice(0, 3).map((m) => {
                      let dotColor = 'bg-ez-pink shadow-[0_0_6px_rgba(255,107,157,0.6)]';
                      if (m.status === 'Live') {
                        dotColor = 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse';
                      } else if (m.status === 'Completed') {
                        dotColor = 'bg-slate-600';
                      }
                      return (
                        <span
                          key={m.id}
                          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                        />
                      );
                    })}
                    {cellMatches.length > 3 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
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
        <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-6">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
            {selectedDateYmd ? (
              <span>
                Matches on{' '}
                <span className="text-white">
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
              className="text-xs font-bold text-ez-pink hover:text-ez-pink/80 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 cursor-pointer transition-colors"
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
              <div className="text-center p-12 text-slate-500 text-sm bg-slate-900/20 border border-slate-800/40 rounded-2xl">
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

                let accentBorder = 'border-l-ez-pink';
                if (isLive) {
                  accentBorder = 'border-l-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.04)]';
                } else if (isCompleted) {
                  accentBorder = 'border-l-slate-700';
                }

                return (
                  <div
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`bg-slate-900/30 border border-slate-800/80 border-l-4 ${accentBorder} rounded-xl p-5 flex items-center justify-between hover:border-slate-700/80 hover:bg-slate-900/40 cursor-pointer transition-all duration-300 group`}
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-400 group-hover:text-slate-300 transition-colors">
                        <FiCalendar className="w-3.5 h-3.5 text-ez-pink/70" />
                        <span>{match.formattedDate}</span>
                        <span>•</span>
                        <FiClock className="w-3.5 h-3.5 text-ez-pink/70" />
                        <span>{match.formattedTime}</span>
                      </div>
                      <div className="text-base md:text-lg font-bold text-white group-hover:text-ez-pink tracking-tight transition-colors">
                        {match.team1}{' '}
                        <span className="text-slate-500 font-medium px-0.5">vs</span>{' '}
                        {match.team2}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isCompleted ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-block px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 text-ez-pink text-xs font-black">
                            {match.result}
                          </span>
                          {match.homeScore !== null && match.awayScore !== null && (
                            <span className="text-xs text-slate-400 font-bold">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          )}
                        </div>
                      ) : isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Live
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-500 text-[10px] uppercase font-black tracking-wider">
                          Upcoming
                        </span>
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
              className="bg-slate-950 border border-slate-800/80 rounded-2xl w-full max-w-xl overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10"
            >
              {/* Modal Header Cover */}
              <div className="bg-gradient-to-r from-ez-pink/15 to-transparent border-b border-slate-900 px-6 py-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-ez-pink bg-ez-pink/10 border border-ez-pink/20 rounded-md px-2 py-0.5">
                    {selectedMatch.division} Division
                  </span>
                  <h4 className="text-lg font-black text-white mt-1 uppercase tracking-tight">Match Details</h4>
                </div>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
                  aria-label="Close details"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                
                {/* Versus Visualizer */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 md:p-6 flex items-center justify-between gap-2 relative overflow-hidden">
                  
                  {/* Glowing background highlights */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-transparent to-transparent pointer-events-none" />

                  {/* Team 1 (Home) */}
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider mb-1">Home</div>
                    <div className="text-base md:text-lg font-black text-white truncate px-1">
                      {selectedMatch.team1}
                    </div>
                  </div>

                  {/* VS / Score Hub */}
                  <div className="flex flex-col items-center justify-center shrink-0 min-w-[70px] z-10">
                    {selectedMatch.status === 'Completed' && selectedMatch.homeScore !== null && selectedMatch.awayScore !== null ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl md:text-3xl font-black ${selectedMatch.homeScore > selectedMatch.awayScore ? 'text-ez-pink' : 'text-slate-400'}`}>
                          {selectedMatch.homeScore}
                        </span>
                        <span className="text-slate-600 font-extrabold text-sm">-</span>
                        <span className={`text-2xl md:text-3xl font-black ${selectedMatch.awayScore > selectedMatch.homeScore ? 'text-ez-pink' : 'text-slate-400'}`}>
                          {selectedMatch.awayScore}
                        </span>
                      </div>
                    ) : selectedMatch.status === 'Live' ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs uppercase animate-pulse">
                        Live
                      </span>
                    ) : (
                      <span className="text-slate-600 font-black text-lg italic tracking-widest">VS</span>
                    )}
                  </div>

                  {/* Team 2 (Away) */}
                  <div className="flex-1 text-center min-w-0">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider mb-1">Away</div>
                    <div className="text-base md:text-lg font-black text-white truncate px-1">
                      {selectedMatch.team2}
                    </div>
                  </div>
                </div>

                {/* Details List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex items-center gap-3.5">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-ez-pink/80 shrink-0">
                      <FiCalendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Date</div>
                      <div className="text-sm font-bold text-white mt-0.5 leading-tight">{selectedMatch.formattedDate}</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex items-center gap-3.5">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-ez-pink/80 shrink-0">
                      <FiClock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Time</div>
                      <div className="text-sm font-bold text-white mt-0.5 leading-tight">
                        {selectedMatch.formattedTime} <span className="text-slate-500 text-xs font-semibold">(EST)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Callout Banner */}
                <div className="bg-slate-900/20 border border-slate-900/60 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      selectedMatch.status === 'Completed'
                        ? 'bg-slate-600'
                        : selectedMatch.status === 'Live'
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-ez-pink'
                    }`} />
                    <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wide">
                      Match Status:{' '}
                      <span className="text-white">{selectedMatch.status}</span>
                    </span>
                  </div>

                  {selectedMatch.status === 'Completed' && (
                    <span className="text-xs text-slate-400 font-bold bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-1">
                      Result: <span className="text-ez-pink font-black">{selectedMatch.result?.split(' ')[0] === 'W' ? 'Completed' : 'Completed'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-900/30 border-t border-slate-900 px-6 py-4 flex items-center justify-end gap-3">
                <Link
                  href={`/${gameSlug}/standings?division=${division}`}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  onClick={() => setSelectedMatch(null)}
                >
                  View Standings
                </Link>
                <Link
                  href={`/${gameSlug}/teams`}
                  className="px-4 py-2 rounded-lg bg-ez-pink text-ez-black hover:bg-ez-pink/80 text-xs font-extrabold transition-colors cursor-pointer"
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
