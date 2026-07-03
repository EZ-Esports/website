'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { updateMatchScore, deleteMatch } from '@/app/(admin)/admin/matches/actions';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import { fetchMatchesPage } from '@/app/lib/match-actions';
import type { MatchCursor, MatchPageItemDto, MatchPageResponse } from '@/app/lib/db/match-page';
import { selectClass } from '@/app/components/admin/styles';

const PAGE_SIZE = 25;

interface Season {
  id: string;
  name: string;
  gameId: string;
  isActive: boolean;
}

interface Game {
  id: string;
  shortName: string;
}

interface AdminMatchExplorerProps {
  seasons: Season[];
  games: Game[];
  initialPage: MatchPageResponse;
}

/**
 * Server-driven match manager: facet changes and pagination go through the
 * fetchMatchesPage action instead of shipping every match to the client.
 * Inline score/status editing and deletion are preserved per row.
 */
export default function AdminMatchExplorer({ seasons, games, initialPage }: AdminMatchExplorerProps) {
  const [gameId, setGameId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [division, setDivision] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  const [items, setItems] = useState<MatchPageItemDto[]>(initialPage.items);
  const [cursor, setCursor] = useState<MatchCursor | null>(initialPage.nextCursor);
  const [isLoading, startLoading] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const seasonMap = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const seasonOptions = gameId ? seasons.filter((s) => s.gameId === gameId) : seasons;

  const request = useMemo(
    () => ({
      gameId: gameId || undefined,
      seasonId: seasonId || undefined,
      division: division || undefined,
      status: status || undefined,
      search: search || undefined,
      sort,
      limit: PAGE_SIZE,
    }),
    [gameId, seasonId, division, status, search, sort]
  );

  // Reload page 1 whenever facets change (debounced for the search box).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startLoading(async () => {
        const page = await fetchMatchesPage(request);
        setItems(page.items);
        setCursor(page.nextCursor);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [request]);

  const loadMore = () => {
    if (!cursor) return;
    startLoading(async () => {
      const page = await fetchMatchesPage({ ...request, cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  };

  useEffect(() => {
    if (!toast || toast.type === 'error') return; // errors linger until next action
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = (matchId: string) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Client-side mirror of the server guard for instant feedback.
    const newStatus = fd.get('status') as string;
    const home = (fd.get('homeScore') as string)?.trim();
    const away = (fd.get('awayScore') as string)?.trim();
    if ((newStatus === 'completed' || newStatus === 'forfeit') && (!home || !away)) {
      setToast({ message: 'Enter both scores before marking a match completed or forfeit.', type: 'error' });
      return;
    }
    setSavingId(matchId);
    startLoading(async () => {
      const res = await updateMatchScore(matchId, fd);
      setSavingId(null);
      setToast(res?.success
        ? { message: 'Match saved.', type: 'success' }
        : { message: res?.error || 'Could not save match.', type: 'error' });
    });
  };

  const handleGameChange = (id: string) => {
    setGameId(id);
    // Reset the season facet if it belongs to a different game.
    if (id && seasonId && seasonMap.get(seasonId)?.gameId !== id) setSeasonId('');
  };

  return (
    <>
    {toast && (
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-semibold shadow-lg border ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}
      >
        {toast.message}
      </div>
    )}
    <div className="bg-[#1c1c1c]/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
      <div className="px-6 py-5 border-b border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Match Fixtures</h2>
          <input
            type="text"
            placeholder="Search schools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 w-full sm:w-48"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={gameId} onChange={(e) => handleGameChange(e.target.value)} className={selectClass}>
            <option value="">All Games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.shortName}</option>
            ))}
          </select>

          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className={selectClass}>
            <option value="">All Seasons</option>
            {seasonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {gameId ? '' : `${gameMap.get(s.gameId)?.shortName} `}{s.name}{s.isActive ? ' (current)' : ''}
              </option>
            ))}
          </select>

          <select value={division} onChange={(e) => setDivision(e.target.value)} className={selectClass}>
            <option value="">All Divisions</option>
            <option value="Varsity">Varsity</option>
            <option value="JV">JV</option>
            <option value="All">All (individual)</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="forfeit">Forfeit</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => setSort(sort === 'desc' ? 'asc' : 'desc')}
            className={`${selectClass} font-bold`}
            title="Toggle date sort"
          >
            {sort === 'desc' ? 'Newest ↓' : 'Oldest ↑'}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center p-12 text-slate-500 text-sm">
          {isLoading ? 'Loading…' : 'No matches found for these filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0b101d] border-b border-slate-900 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Season / Date</th>
                <th className="px-6 py-4 text-center">Matchup & Scores</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {items.map((match) => {
                const season = seasonMap.get(match.seasonId);
                const game = season ? gameMap.get(season.gameId) : null;
                const deleteActionWithId = deleteMatch.bind(null, match.id);
                const isSaving = savingId === match.id;

                return (
                  <tr key={match.id} className="hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                        {game?.shortName} • {season?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <form id={`form-${match.id}`} onSubmit={handleSave(match.id)} className="flex items-center justify-center gap-3">
                        <div className="text-right w-28 truncate">
                          <span className="block font-semibold text-white text-sm truncate" title={match.homeTeam}>{match.homeTeam}</span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{match.division}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <input
                            name="homeScore"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            defaultValue={match.homeScore ?? ''}
                            className="w-10 h-8 bg-slate-950 border border-slate-800 rounded text-center text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 text-xs font-bold"
                            placeholder="-"
                          />
                          <span className="text-slate-600 text-[10px] font-bold uppercase select-none">vs</span>
                          <input
                            name="awayScore"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            defaultValue={match.awayScore ?? ''}
                            className="w-10 h-8 bg-slate-950 border border-slate-800 rounded text-center text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 text-xs font-bold"
                            placeholder="-"
                          />
                        </div>

                        <div className="text-left w-28 truncate">
                          <span className="block font-semibold text-white text-sm truncate" title={match.awayTeam}>{match.awayTeam}</span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{match.division}</span>
                        </div>
                      </form>
                    </td>

                    <td className="px-6 py-4">
                      <select
                        name="status"
                        form={`form-${match.id}`}
                        defaultValue={match.status}
                        className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-ez-pink/50 cursor-pointer font-medium"
                      >
                        <option value="scheduled" className="bg-slate-900 text-white">Scheduled</option>
                        <option value="live" className="bg-slate-900 text-white">Live</option>
                        <option value="completed" className="bg-slate-900 text-white">Completed</option>
                        <option value="forfeit" className="bg-slate-900 text-white">Forfeit</option>
                        <option value="cancelled" className="bg-slate-900 text-white">Cancelled</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="submit"
                          form={`form-${match.id}`}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded text-slate-300 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                        <ConfirmDeleteButton
                          action={async () => {
                            await deleteActionWithId();
                            setItems((prev) => prev.filter((m) => m.id !== match.id));
                          }}
                          message={`Permanently delete this match (${match.homeTeam} vs ${match.awayTeam})? This cannot be undone.`}
                          label="Delete"
                          className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 border-t border-zinc-800 text-center">
        {cursor ? (
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded text-slate-300 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : `Load ${PAGE_SIZE} more`}
          </button>
        ) : (
          <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
            {items.length > 0 ? 'All matching fixtures loaded' : ''}
          </span>
        )}
      </div>
    </div>
    </>
  );
}
