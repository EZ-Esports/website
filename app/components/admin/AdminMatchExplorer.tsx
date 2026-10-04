'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { updateMatchScore, deleteMatch } from '@/app/(admin)/admin/matches/actions';
import { HiArrowsUpDown, HiOutlineCalendarDays } from 'react-icons/hi2';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import {
  saveBtn,
  secondaryBtnSm,
  selectClass,
  selectClassCompact,
  table,
  tableWrap,
  tbody,
  tdCompact,
  tdCompactRight,
  thCompact,
  thCompactRight,
  theadRow,
  tr,
} from '@/app/components/admin/styles';
import {
  AdminEmptyState,
  AdminSearchField,
  AdminSection,
  AdminSkeletonRows,
  AdminSpinner,
  AdminToast,
  PendingLabel,
} from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';
import { fetchMatchesPage } from '@/app/lib/match-actions';
import type { MatchCursor, MatchPageItemDto, MatchPageResponse } from '@/app/lib/db/match-page';
import { formatNY } from '@/app/lib/dates';

const PAGE_SIZE = 25;

/** "Wed, Sep 23, 2026" in Eastern time: the fixtures column has no room for the long month name. */
const shortDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

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

  const scoreInput =
    'h-8 w-8 rounded-md border border-line/70 bg-surface-sunken text-center text-sm font-semibold tabular-nums text-foreground transition-[border-color,box-shadow] duration-150 hover:border-line focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

  return (
    <>
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
      <AdminSection
        variant="flush"
        stickyToolbar
        title="Match fixtures"
        actions={
          <AdminSearchField
            size="sm"
            className="w-full sm:w-56"
            aria-label="Search schools"
            placeholder="Search schools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Game" value={gameId} onChange={(e) => handleGameChange(e.target.value)} className={selectClass}>
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.shortName}</option>
              ))}
            </select>

            <select aria-label="Season" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className={selectClass}>
              <option value="">All seasons</option>
              {seasonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {gameId ? '' : `${gameMap.get(s.gameId)?.shortName} `}{s.name}{s.isActive ? ' (current)' : ''}
                </option>
              ))}
            </select>

            <select aria-label="Division" value={division} onChange={(e) => setDivision(e.target.value)} className={selectClass}>
              <option value="">All divisions</option>
              <option value="Varsity">Varsity</option>
              <option value="JV">JV</option>
              <option value="All">All (individual)</option>
            </select>

            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="forfeit">Forfeit</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button
              type="button"
              onClick={() => setSort(sort === 'desc' ? 'asc' : 'desc')}
              className={secondaryBtnSm}
              title="Toggle date sort"
            >
              <HiArrowsUpDown aria-hidden className="h-3.5 w-3.5" />
              {sort === 'desc' ? 'Newest first' : 'Oldest first'}
            </button>

            {isLoading && (
              <span role="status" className="ml-auto inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
                <AdminSpinner /> Loading…
              </span>
            )}
          </div>
        }
      >
        {items.length === 0 ? (
          isLoading ? (
            <AdminSkeletonRows rows={5} />
          ) : (
            <AdminEmptyState compact icon={<HiOutlineCalendarDays />} title="No matches found for these filters." />
          )
        ) : (
          // Dimmed (not hidden) while a filter change loads, so the layout never jumps.
          <div className={cx(tableWrap, 'transition-opacity duration-200', isLoading && 'opacity-60')} aria-busy={isLoading}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={thCompact}>Season / date</th>
                  <th className={cx(thCompact, 'text-center')}>Matchup &amp; scores</th>
                  <th className={thCompact}>Status</th>
                  <th className={thCompactRight}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {items.map((match) => {
                  const season = seasonMap.get(match.seasonId);
                  const game = season ? gameMap.get(season.gameId) : null;
                  const deleteActionWithId = deleteMatch.bind(null, match.id);
                  const isSaving = savingId === match.id;

                  return (
                    <tr key={match.id} className={tr}>
                      {/* Date and time wrap onto their own lines so this column stays narrow. */}
                      <td className={tdCompact}>
                        <div className="text-sm font-medium text-foreground">
                          {game?.shortName} · {season?.name}
                        </div>
                        <div className="mt-0.5 text-xs leading-4 text-foreground-secondary">
                          <span className="block whitespace-nowrap">{shortDate.format(new Date(match.scheduledAt))}</span>
                          <span className="block">{formatNY(new Date(match.scheduledAt), 'time')}</span>
                        </div>
                      </td>

                      <td className={tdCompact}>
                        <form id={`form-${match.id}`} onSubmit={handleSave(match.id)} className="flex items-center justify-center gap-1.5">
                          <div className="w-16 truncate text-right 2xl:w-28">
                            <span className="block truncate text-sm font-medium text-foreground" title={match.homeTeam}>{match.homeTeam}</span>
                            <span className="text-xs text-foreground-secondary">{match.division}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              name="homeScore"
                              aria-label={`${match.homeTeam} score`}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              defaultValue={match.homeScore ?? ''}
                              className={scoreInput}
                              placeholder="-"
                            />
                            <span className="select-none text-xs text-foreground-secondary">vs</span>
                            <input
                              name="awayScore"
                              aria-label={`${match.awayTeam} score`}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              defaultValue={match.awayScore ?? ''}
                              className={scoreInput}
                              placeholder="-"
                            />
                          </div>

                          <div className="w-16 truncate text-left 2xl:w-28">
                            <span className="block truncate text-sm font-medium text-foreground" title={match.awayTeam}>{match.awayTeam}</span>
                            <span className="text-xs text-foreground-secondary">{match.division}</span>
                          </div>
                        </form>
                      </td>

                      <td className={tdCompact}>
                        <select
                          name="status"
                          aria-label={`Status for ${match.homeTeam} vs ${match.awayTeam}`}
                          form={`form-${match.id}`}
                          defaultValue={match.status}
                          className={selectClassCompact}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="live">Live</option>
                          <option value="completed">Completed</option>
                          <option value="forfeit">Forfeit</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      <td className={tdCompactRight}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="submit"
                            form={`form-${match.id}`}
                            disabled={isSaving}
                            aria-busy={isSaving}
                            aria-label={`Save match ${match.homeTeam} vs ${match.awayTeam}`}
                            className={saveBtn}
                          >
                            {/* Text only (no spinner): this column has no width to spare. */}
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          <ConfirmDeleteButton
                            action={async () => {
                              await deleteActionWithId();
                              setItems((prev) => prev.filter((m) => m.id !== match.id));
                            }}
                            message={`Permanently delete this match (${match.homeTeam} vs ${match.awayTeam})? This cannot be undone.`}
                            label={`Delete match ${match.homeTeam} vs ${match.awayTeam}`}
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

        <div className="flex items-center justify-center border-t border-line/60 px-5 py-4">
          {cursor ? (
            <button type="button" onClick={loadMore} disabled={isLoading} aria-busy={isLoading} className={secondaryBtnSm}>
              <PendingLabel pending={isLoading} label={`Load ${PAGE_SIZE} more`} pendingLabel="Loading…" />
            </button>
          ) : (
            <span className="text-xs text-foreground-secondary">
              {items.length > 0 ? 'All matching fixtures loaded' : ''}
            </span>
          )}
        </div>
      </AdminSection>
    </>
  );
}
