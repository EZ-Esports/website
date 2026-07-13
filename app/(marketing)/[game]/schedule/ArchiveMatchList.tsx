'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { FiCalendar, FiClock } from 'react-icons/fi';
import { fetchMatchesPage } from '@/app/lib/match-actions';
import type { MatchCursor, MatchPageItemDto } from '@/app/lib/db/match-page';
import { formatNY } from '@/app/lib/dates';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';

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
      <Badge variant="warning">
        Forfeit {match.homeScore !== null && match.awayScore !== null && `${match.homeScore}-${match.awayScore}`}
      </Badge>
    );
  }
  if (match.homeScore !== null && match.awayScore !== null) {
    return (
      <Badge>
        {match.homeScore} - {match.awayScore}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" size="sm">
      {match.status === 'completed' ? 'No result recorded' : match.status}
    </Badge>
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
      <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
        No matches recorded for this season and division.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((match) => (
          <Card
            key={match.id}
            accent
            interactive
            padding="sm"
            className="flex items-center justify-between group"
          >
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-foreground-secondary group-hover:text-foreground transition-colors">
                <FiCalendar className="w-3.5 h-3.5 text-accent/70" />
                <span>{formatNY(new Date(match.scheduledAt), 'date-short')}</span>
                <span>•</span>
                <FiClock className="w-3.5 h-3.5 text-accent/70" />
                <span>{formatNY(new Date(match.scheduledAt), 'time')}</span>
              </div>
              <div className="text-base md:text-lg font-bold text-foreground tracking-tight">
                {match.homeTeam} <span className="text-foreground-muted font-medium px-0.5">vs</span> {match.awayTeam}
              </div>
            </div>
            <div className="text-right shrink-0">
              <StatusBadge match={match} />
            </div>
          </Card>
        ))}
      </div>

      {/* Sentinel + manual fallback */}
      <div ref={sentinelRef} className="pt-6 text-center">
        {cursor ? (
          <Button variant="outline" onClick={loadMore} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load more matches'}
          </Button>
        ) : (
          <p className="text-xs text-foreground-muted font-semibold uppercase tracking-wider">End of season</p>
        )}
      </div>
    </div>
  );
}
