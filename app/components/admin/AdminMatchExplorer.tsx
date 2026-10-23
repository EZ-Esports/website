'use client';

import { useSearchParams } from 'next/navigation';
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
import { fetchStaffMatchesPage } from '@/app/lib/match-actions';
import type { MatchCursor, MatchPageItemDto, MatchPageResponse } from '@/app/lib/db/match-page';
import { formatNY } from '@/app/lib/dates';
import {
  DEFAULT_MATCH_FACETS,
  matchFacetsKey,
  matchFetchDelayMs,
  nextMatchFilterSearch,
  parseMatchFilterParams,
  shouldAdoptServerPage,
  type MatchFacets,
  type MatchFilterChange,
} from '@/app/lib/admin-season-filters';

const PAGE_SIZE = 25;

const pageRequest = (f: MatchFacets) => ({
  gameId: f.gameId || undefined,
  seasonId: f.seasonId || undefined,
  division: f.division || undefined,
  status: f.status || undefined,
  search: f.search || undefined,
  sort: f.sort,
  limit: PAGE_SIZE,
});

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
  slug: string;
}

interface AdminMatchExplorerProps {
  seasons: Season[];
  games: Game[];
  /** Server's first page for the URL's validated filters; replaced on each server render. */
  initialPage: MatchPageResponse;
  /** The validated game/season `initialPage` was loaded for. */
  initialFilters: { gameId: string; seasonId: string };
}

/**
 * Game and season come from the address (`?game=&season=`), validated by
 * parseMatchFilterParams: picking one rewrites the URL (history.replaceState, no
 * server re-render), links change it, and the component only reads it. Division,
 * status, search and sort are local. Facet changes and pagination go through
 * fetchStaffMatchesPage. Inline score/status editing and deletion are per row.
 */
export default function AdminMatchExplorer({ seasons, games, initialPage, initialFilters }: AdminMatchExplorerProps) {
  const searchParams = useSearchParams();
  const { gameId, seasonId } = useMemo(
    () => parseMatchFilterParams({ game: searchParams.get('game') ?? undefined, season: searchParams.get('season') ?? undefined }, games, seasons),
    [searchParams, games, seasons]
  );
  const [division, setDivision] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  const [items, setItems] = useState<MatchPageItemDto[]>(initialPage.items);
  const [cursor, setCursor] = useState<MatchCursor | null>(initialPage.nextCursor);
  // The facets `items` were loaded for; differs from `facets` while a refetch is pending.
  const [loaded, setLoaded] = useState<MatchFacets>({ ...DEFAULT_MATCH_FACETS, ...initialFilters });
  const [seenPage, setSeenPage] = useState(initialPage);
  // Game/season this component itself wrote to the URL via a select while its fetch is pending;
  // a server refresh landing for exactly those filters must not reset the local facets.
  const [ownWrite, setOwnWrite] = useState<{ gameId: string; seasonId: string } | null>(null);
  // Key of the requested facets whose refetch failed; the old rows and `loaded` stay as they were.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // A link navigation re-renders the server page with a new initialPage for the new URL
  // filters: show it now (no stale rows, no refetch) and reset local facets as a remount
  // would. Select changes use replaceState, so they never get here; a refresh for the
  // filters already shown is ignored.
  if (seenPage !== initialPage) {
    setSeenPage(initialPage);
    if (shouldAdoptServerPage(initialFilters, loaded, ownWrite)) {
      setDivision(DEFAULT_MATCH_FACETS.division);
      setStatus(DEFAULT_MATCH_FACETS.status);
      setSearch(DEFAULT_MATCH_FACETS.search);
      setSort(DEFAULT_MATCH_FACETS.sort);
      setItems(initialPage.items);
      setCursor(initialPage.nextCursor);
      setLoaded({ ...DEFAULT_MATCH_FACETS, ...initialFilters });
      setLoadError(null);
      setOwnWrite(null);
    }
  }

  const seasonMap = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const seasonOptions = gameId ? seasons.filter((s) => s.gameId === gameId) : seasons;

  const facets = useMemo<MatchFacets>(
    () => ({ gameId, seasonId, division, status, search, sort }),
    [gameId, seasonId, division, status, search, sort]
  );
  const facetsKey = matchFacetsKey(facets);
  const isStale = facetsKey !== matchFacetsKey(loaded);
  // Changing any filter changes the key, so a failure never outlives the request it belongs to.
  const refetchFailed = isStale && loadError === facetsKey;
  const isRefetching = isLoading || (isStale && !refetchFailed);
  // Rows of another game/season are hidden (skeleton); other facet changes just dim them.
  const scopeStale = loaded.gameId !== gameId || loaded.seasonId !== seasonId;

  // Write a filter change to the address. Computed from the live location (not the rendered
  // searchParams) so rapid successive changes build on each other and the last choice wins.
  // Next syncs history.replaceState into useSearchParams without re-running the server page.
  const writeFilter = (change: MatchFilterChange) => {
    const qs = nextMatchFilterSearch(window.location.search, change, games, seasons);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    const sp = new URLSearchParams(qs);
    setOwnWrite(parseMatchFilterParams({ game: sp.get('game') ?? undefined, season: sp.get('season') ?? undefined }, games, seasons));
  };

  // Reload page 1 when the requested facets differ from the loaded ones (only the search
  // box is debounced). Every run bumps fetchSeq, so responses from superseded requests
  // and in-flight "Load more" calls are discarded. A failed refetch leaves rows, cursor and
  // `loaded` untouched (so requested != loaded keeps the stale state visible) and records the
  // failure; the Retry button bumps retryTick to run the effect again for the same facets.
  const fetchSeq = useRef(0);
  useEffect(() => {
    const seq = ++fetchSeq.current;
    if (matchFacetsKey(facets) === matchFacetsKey(loaded)) return;
    const timer = setTimeout(() => {
      startLoading(async () => {
        try {
          const page = await fetchStaffMatchesPage(pageRequest(facets));
          if (seq !== fetchSeq.current) return;
          setItems(page.items);
          setCursor(page.nextCursor);
          setLoaded(facets);
          setLoadError(null);
          setOwnWrite(null);
        } catch {
          if (seq !== fetchSeq.current) return;
          setLoadError(matchFacetsKey(facets));
          setToast({ message: 'Could not load matches.', type: 'error' });
        }
      });
    }, matchFetchDelayMs(loaded, facets));
    return () => clearTimeout(timer);
  }, [facets, loaded, retryTick]);

  const retry = () => {
    setToast(null);
    setLoadError(null);
    setRetryTick((n) => n + 1);
  };

  const loadMore = () => {
    if (!cursor || isStale) return;
    const seq = fetchSeq.current;
    startLoading(async () => {
      try {
        const page = await fetchStaffMatchesPage({ ...pageRequest(loaded), cursor });
        if (seq !== fetchSeq.current) return; // filters changed while loading
        setItems((prev) => [...prev, ...page.items]);
        setCursor(page.nextCursor);
      } catch {
        if (seq === fetchSeq.current) setToast({ message: 'Could not load more matches.', type: 'error' });
      }
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
            <select aria-label="Game" value={gameId} onChange={(e) => writeFilter({ game: e.target.value })} className={selectClass}>
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.shortName}</option>
              ))}
            </select>

            <select aria-label="Season" value={seasonId} onChange={(e) => writeFilter({ season: e.target.value })} className={selectClass}>
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

            {isRefetching && (
              <span role="status" className="ml-auto inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
                <AdminSpinner /> Loading…
              </span>
            )}
          </div>
        }
      >
        {refetchFailed && (
          <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-line/60 bg-surface-sunken px-5 py-3 text-sm text-foreground">
            <span>Could not load matches for these filters.{scopeStale ? '' : ' Showing the previous results.'}</span>
            <button type="button" onClick={retry} className={secondaryBtnSm}>Retry</button>
          </div>
        )}
        {scopeStale || items.length === 0 ? (
          (scopeStale || isLoading || isStale) && !refetchFailed ? (
            <AdminSkeletonRows rows={5} />
          ) : scopeStale ? null : (
            <AdminEmptyState compact icon={<HiOutlineCalendarDays />} title="No matches found for these filters." />
          )
        ) : (
          // Dimmed (not hidden) while a filter change loads, so the layout never jumps.
          <div className={cx(tableWrap, 'transition-opacity duration-200', (isLoading || isStale) && 'opacity-60')} aria-busy={isRefetching}>
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
          {scopeStale ? null : cursor ? (
            <button type="button" onClick={loadMore} disabled={isLoading || isStale} aria-busy={isLoading} className={secondaryBtnSm}>
              <PendingLabel pending={isLoading} label={`Load ${PAGE_SIZE} more`} pendingLabel="Loading…" />
            </button>
          ) : (
            <span className="text-xs text-foreground-secondary">
              {items.length > 0 && !scopeStale ? 'All matching fixtures loaded' : ''}
            </span>
          )}
        </div>
      </AdminSection>
    </>
  );
}
