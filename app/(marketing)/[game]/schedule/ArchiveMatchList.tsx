'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { FiCalendar, FiClock } from 'react-icons/fi';
import { fetchMatchesPage } from '@/app/lib/match-actions';
import type { MatchCursor, MatchPageItemDto } from '@/app/lib/db/match-page';
import { formatNY } from '@/app/lib/dates';

interface ArchiveMatchListProps {
  seasonId: string;
  division: string;
  sort: 'asc' | 'desc';
  initialItems: MatchPageItemDto[];
  initialCursor: MatchCursor | null;
}

function StatusBadge({ match }: { match: MatchPageItemDto }) {
  if (match.status === 'forfeit') {
    return (
      <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black">
        Forfeit {match.homeScore !== null && match.awayScore !== null && `${match.homeScore}-${match.awayScore}`}
      </span>
    );
  }
  if (match.homeScore !== null && match.awayScore !== null) {
    return (
      <span className="inline-block px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 text-ez-pink text-xs font-black">
        {match.homeScore} - {match.awayScore}
      </span>
    );
  }
  return (
    <span className="inline-block px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-500 text-[10px] uppercase font-black tracking-wider">
      {match.status === 'completed' ? 'No result recorded' : match.status}
    </span>
  );
}

/**
 * Lazily-loaded match list for archived seasons: renders the server-provided
 * first page, then pulls further pages through the fetchMatchesPage action
 * when the sentinel scrolls into view (with a button fallback).
 */
export default function ArchiveMatchList({
  seasonId,
  division,
  sort,
  initialItems,
  initialCursor,
}: ArchiveMatchListProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const page = await fetchMatchesPage({ seasonId, division, sort, cursor, limit: 20 });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  }, [cursor, isPending, seasonId, division, sort]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (items.length === 0) {
    return (
      <div className="text-center p-12 text-slate-500 text-sm bg-slate-900/20 border border-slate-800/40 rounded-2xl">
        No matches recorded for this season and division.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((match) => (
          <div
            key={match.id}
            className="bg-slate-900/30 border border-slate-800/80 border-l-4 border-l-slate-700 rounded-xl p-5 flex items-center justify-between hover:border-slate-700/80 hover:bg-slate-900/40 transition-all duration-300 group"
          >
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-400 group-hover:text-slate-300 transition-colors">
                <FiCalendar className="w-3.5 h-3.5 text-ez-pink/70" />
                <span>{formatNY(new Date(match.scheduledAt), 'date-short')}</span>
                <span>•</span>
                <FiClock className="w-3.5 h-3.5 text-ez-pink/70" />
                <span>{formatNY(new Date(match.scheduledAt), 'time')}</span>
              </div>
              <div className="text-base md:text-lg font-bold text-white tracking-tight">
                {match.homeTeam} <span className="text-slate-500 font-medium px-0.5">vs</span> {match.awayTeam}
              </div>
            </div>
            <div className="text-right shrink-0">
              <StatusBadge match={match} />
            </div>
          </div>
        ))}
      </div>

      {/* Sentinel + manual fallback */}
      <div ref={sentinelRef} className="pt-6 text-center">
        {cursor ? (
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-5 py-2.5 min-h-[44px] text-sm font-bold rounded-lg bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer disabled:opacity-60"
          >
            {isPending ? 'Loading…' : 'Load more matches'}
          </button>
        ) : (
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">End of season</p>
        )}
      </div>
    </div>
  );
}
