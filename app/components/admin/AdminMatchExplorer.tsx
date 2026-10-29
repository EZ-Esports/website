'use client';

import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { updateMatchScore, deleteMatch, deleteMatches } from '@/app/(admin)/admin/matches/actions';
import { HiOutlineCalendarDays, HiOutlineCheckCircle, HiOutlineEllipsisVertical, HiOutlineNoSymbol, HiOutlineTrash, HiPlus } from 'react-icons/hi2';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import ScheduleMatchDialog from '@/app/components/admin/ScheduleMatchDialog';
import GenerateSeasonDialog, { type GenerateSchoolOption } from '@/app/components/admin/GenerateSeasonDialog';
import {
  chip,
  dangerBtn,
  ghostBtnSm,
  input,
  primaryBtn,
  primaryBtnSm,
  secondaryBtn,
  secondaryBtnSm,
  selectClass,
  type ChipTone,
} from '@/app/components/admin/styles';
import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSkeletonRows,
  AdminSpinner,
  AdminToast,
  PendingLabel,
} from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';
import { fetchStaffMatchesPage, fetchStaffMatchTabCounts } from '@/app/lib/match-actions';
import {
  MATCH_TABS,
  MATCH_TAB_LABELS,
  divisionLabel,
  effectiveSort,
  needsResult,
  type MatchCursor,
  type MatchPageItemDto,
  type MatchPageResponse,
  type MatchStatus,
  type MatchTab,
  type MatchTabCounts,
} from '@/app/lib/db/match-page';
import { formatNY } from '@/app/lib/dates';
import { applySavedMatch, divisionBlockStarts, groupMatchesByDay, parseScoreInput } from '@/app/lib/admin-match-list';
import {
  DEFAULT_MATCH_FACETS,
  hasActiveMoreFilters,
  matchCountsKey,
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
  tab: f.tab,
  search: f.search || undefined,
  sort: effectiveSort(f.tab, f.sort),
  limit: PAGE_SIZE,
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
  displayName: string;
  slug: string;
}

type ScheduleFormData = Omit<React.ComponentProps<typeof ScheduleMatchDialog>, 'isOpen' | 'onOpenChange' | 'onScheduled'>;

interface AdminMatchExplorerProps {
  /** Every season (active and inactive) for the Season filter. */
  seasons: Season[];
  games: Game[];
  /** Server's first page for the URL's validated filters and the default tab; replaced on each server render. */
  initialPage: MatchPageResponse;
  /** The validated game/season `initialPage` was loaded for. */
  initialFilters: { gameId: string; seasonId: string };
  /** The tab `initialPage` was loaded for (see defaultMatchTab). */
  initialTab: MatchTab;
  initialCounts: MatchTabCounts | null;
  /** Server clock (ISO) used for the first render so "Needs result" does not flicker on hydration. */
  serverNow: string;
  back?: { href: string; label: string };
  /** Active seasons, rosters and teams for the schedule dialog. */
  scheduleForm: ScheduleFormData;
  /** Active schools offered by Generate season. */
  generateSchools: GenerateSchoolOption[];
  /** Extra sections between the header and the filters (the reschedule queue). */
  children?: React.ReactNode;
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  completed: 'Completed',
  forfeit: 'Forfeit',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<MatchStatus, ChipTone> = {
  scheduled: 'neutral',
  live: 'accent',
  completed: 'success',
  forfeit: 'danger',
  cancelled: 'danger',
};

const EMPTY_COPY: Record<MatchTab, { title: string; description?: string }> = {
  'needs-results': { title: 'You are all caught up', description: 'Every match that has been played has a result.' },
  upcoming: { title: 'Nothing scheduled', description: 'Use Schedule match to add the next fixture.' },
  completed: { title: 'No completed matches for these filters.' },
  all: { title: 'No matches found for these filters.', description: 'Try clearing the search or filters.' },
};

const touchTarget = 'max-sm:h-11 max-sm:min-w-11';

/**
 * The staff Matches page body (spec-030). Game and season come from the address
 * (`?game=&season=`), validated by parseMatchFilterParams: picking one rewrites the
 * URL (history.replaceState, no server re-render), links change it, and the component
 * only reads it. The status tab, division, search and sort are local. The tab is a
 * server-side filter, and its counts come from fetchStaffMatchTabCounts for the same
 * facets, so both stay right across pagination. Facet changes and pagination go
 * through fetchStaffMatchesPage; editing and deleting act on one row at a time.
 */
export default function AdminMatchExplorer({
  seasons,
  games,
  initialPage,
  initialFilters,
  initialTab,
  initialCounts,
  serverNow,
  back,
  scheduleForm,
  generateSchools,
  children,
}: AdminMatchExplorerProps) {
  const searchParams = useSearchParams();
  const { gameId, seasonId } = useMemo(
    () => parseMatchFilterParams({ game: searchParams.get('game') ?? undefined, season: searchParams.get('season') ?? undefined }, games, seasons),
    [searchParams, games, seasons]
  );
  const [division, setDivision] = useState('');
  const [tab, setTab] = useState<MatchTab>(initialTab);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<MatchFacets['sort']>('auto');
  const [moreOpen, setMoreOpen] = useState(false);

  const [items, setItems] = useState<MatchPageItemDto[]>(initialPage.items);
  const [cursor, setCursor] = useState<MatchCursor | null>(initialPage.nextCursor);
  const [counts, setCounts] = useState<MatchTabCounts | null>(initialCounts);
  // The facets `items` were loaded for; differs from `facets` while a refetch is pending.
  const [loaded, setLoaded] = useState<MatchFacets>({ ...DEFAULT_MATCH_FACETS, ...initialFilters, tab: initialTab });
  const [seenPage, setSeenPage] = useState(initialPage);
  // Game/season this component itself wrote to the URL via a select while its fetch is pending;
  // a server refresh landing for exactly those filters must not reset the local facets.
  const [ownWrite, setOwnWrite] = useState<{ gameId: string; seasonId: string } | null>(null);
  // Key of the requested facets whose refetch failed; the old rows and `loaded` stay as they were.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [nowMs, setNowMs] = useState(() => new Date(serverNow).getTime());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [restoreFocusId, setRestoreFocusId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MatchPageItemDto | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Bulk delete: select mode shows a checkbox per row; the selection is ids only and is
  // intersected with the rows on screen, so a filter change can never delete hidden matches.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // A link navigation re-renders the server page with a new initialPage for the new URL
  // filters: show it now (no stale rows, no refetch) and reset local facets as a remount
  // would. Select changes use replaceState, so they never get here; a refresh for the
  // filters already shown is ignored.
  if (seenPage !== initialPage) {
    setSeenPage(initialPage);
    if (shouldAdoptServerPage(initialFilters, loaded, ownWrite)) {
      setDivision(DEFAULT_MATCH_FACETS.division);
      setTab(initialTab);
      setSearch(DEFAULT_MATCH_FACETS.search);
      setSort(DEFAULT_MATCH_FACETS.sort);
      setItems(initialPage.items);
      setCursor(initialPage.nextCursor);
      setCounts(initialCounts);
      setNowMs(new Date(serverNow).getTime());
      setLoaded({ ...DEFAULT_MATCH_FACETS, ...initialFilters, tab: initialTab });
      setLoadError(null);
      setOwnWrite(null);
      setEditingId(null);
    }
  }

  const seasonMap = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const gameMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const seasonOptions = gameId ? seasons.filter((s) => s.gameId === gameId) : seasons;

  const facets = useMemo<MatchFacets>(
    () => ({ gameId, seasonId, division, tab, search, sort }),
    [gameId, seasonId, division, tab, search, sort]
  );
  const facetsKey = matchFacetsKey(facets);
  const isStale = facetsKey !== matchFacetsKey(loaded);
  // Changing any filter changes the key, so a failure never outlives the request it belongs to.
  const refetchFailed = isStale && loadError === facetsKey;
  const isRefetching = isLoading || (isStale && !refetchFailed);
  // Rows of another game/season are hidden (skeleton); other facet changes just dim them.
  const scopeStale = loaded.gameId !== gameId || loaded.seasonId !== seasonId;
  const moreActive = hasActiveMoreFilters(facets);
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  // Write a filter change to the address. Computed from the live location (not the rendered
  // searchParams) so rapid successive changes build on each other and the last choice wins.
  // Next syncs history.replaceState into useSearchParams without re-running the server page.
  const writeFilter = (change: MatchFilterChange) => {
    const qs = nextMatchFilterSearch(window.location.search, change, games, seasons);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    const sp = new URLSearchParams(qs);
    setOwnWrite(parseMatchFilterParams({ game: sp.get('game') ?? undefined, season: sp.get('season') ?? undefined }, games, seasons));
    setEditingId(null);
  };

  // Reload page 1 when the requested facets differ from the loaded ones (only the search
  // box is debounced). Every run bumps fetchSeq, so responses from superseded requests
  // and in-flight "Load more" calls are discarded. Tab totals are refetched together
  // when game, season, division or search changed (a tab or sort change keeps them). A
  // failed refetch leaves rows, cursor and `loaded` untouched (so requested != loaded keeps
  // the stale state visible) and records the failure; Retry bumps retryTick to run it again.
  const fetchSeq = useRef(0);
  const countsSeq = useRef(0);
  const reloadSeq = useRef(0);
  const loadedKeyRef = useRef(matchFacetsKey(loaded));
  useEffect(() => {
    loadedKeyRef.current = matchFacetsKey(loaded);
  }, [loaded]);
  useEffect(() => {
    const seq = ++fetchSeq.current;
    if (matchFacetsKey(facets) === matchFacetsKey(loaded)) return;
    const timer = setTimeout(() => {
      startLoading(async () => {
        try {
          const needCounts = matchCountsKey(facets) !== matchCountsKey(loaded);
          const [page, nextCounts] = await Promise.all([
            fetchStaffMatchesPage(pageRequest(facets)),
            needCounts ? fetchStaffMatchTabCounts(pageRequest(facets)) : Promise.resolve(null),
          ]);
          if (seq !== fetchSeq.current) return;
          setItems(page.items);
          setCursor(page.nextCursor);
          if (nextCounts) {
            countsSeq.current++;
            setCounts(nextCounts);
          }
          setNowMs(Date.now());
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

  /** Totals only: after a save, delete or schedule changed what each tab holds. */
  const refreshCounts = async () => {
    const seq = ++countsSeq.current;
    try {
      const next = await fetchStaffMatchTabCounts(pageRequest(loaded));
      if (seq === countsSeq.current) setCounts(next);
    } catch {
      // Stale totals are better than an error toast on top of a save that worked.
    }
  };

  /** Page 1 and totals for the loaded facets, e.g. after a match was scheduled. */
  const reload = () => {
    // Own sequence guard: bumping fetchSeq here would discard a pending facet refetch
    // (e.g. a debounced search) and leave `loaded` behind forever. The result is applied
    // only if no newer reload started and the loaded facets are still the ones reloaded.
    const seq = ++reloadSeq.current;
    const key = matchFacetsKey(loaded);
    startLoading(async () => {
      try {
        const [page, nextCounts] = await Promise.all([
          fetchStaffMatchesPage(pageRequest(loaded)),
          fetchStaffMatchTabCounts(pageRequest(loaded)),
        ]);
        if (seq !== reloadSeq.current || key !== loadedKeyRef.current) return;
        countsSeq.current++;
        setItems(page.items);
        setCursor(page.nextCursor);
        setCounts(nextCounts);
        setNowMs(Date.now());
      } catch {
        if (seq === reloadSeq.current) setToast({ message: 'Could not refresh matches.', type: 'error' });
      }
    });
  };

  const loadMore = () => {
    if (!cursor || isStale) return;
    const seq = fetchSeq.current;
    startLoading(async () => {
      try {
        const page = await fetchStaffMatchesPage({ ...pageRequest(loaded), cursor });
        if (seq !== fetchSeq.current) return; // filters changed while loading
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...page.items.filter((m) => !seen.has(m.id))];
        });
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

  // Focus: opening an editor lands on its first score box; closing returns to that
  // row's Edit button (or the list itself when the row left the tab).
  useEffect(() => {
    if (editingId) document.getElementById(`score-home-${editingId}`)?.focus();
  }, [editingId]);
  useEffect(() => {
    if (!restoreFocusId) return;
    const target = document.getElementById(`edit-${restoreFocusId}`) ?? listRef.current;
    target?.focus();
    setRestoreFocusId(null);
  }, [restoreFocusId]);

  const closeEditor = (matchId: string) => {
    setEditingId(null);
    setRestoreFocusId(matchId);
  };

  /** Persist a status/score change through the existing updateMatchScore action, then fix the list locally. */
  const persist = async (match: MatchPageItemDto, fd: FormData, status: MatchStatus, successMessage: string) => {
    setSavingId(match.id);
    try {
      const res = await updateMatchScore(match.id, fd);
      if (!res?.success) {
        setToast({ message: res?.error || 'Could not save match.', type: 'error' });
        return false;
      }
      const saved = {
        status,
        homeScore: parseScoreInput(String(fd.get('homeScore') ?? '')),
        awayScore: parseScoreInput(String(fd.get('awayScore') ?? '')),
      };
      const at = new Date();
      setNowMs(at.getTime());
      // Functional update: rows appended by a concurrent "Load more" while the save was in flight must survive.
      setItems((prev) => applySavedMatch(prev, match.id, saved, loaded.tab, at).items);
      setToast({ message: successMessage, type: 'success' });
      void refreshCounts();
      setEditingId(null);
      setRestoreFocusId(match.id);
      return true;
    } catch {
      setToast({ message: 'Could not save match.', type: 'error' });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = (match: MatchPageItemDto) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Client-side mirror of the server guard for instant feedback.
    const status = fd.get('status') as MatchStatus;
    const home = parseScoreInput(String(fd.get('homeScore') ?? ''));
    const away = parseScoreInput(String(fd.get('awayScore') ?? ''));
    if (Number.isNaN(home) || Number.isNaN(away)) {
      setToast({ message: 'Scores must be whole numbers.', type: 'error' });
      return;
    }
    if ((status === 'completed' || status === 'forfeit') && (home === null || away === null)) {
      setToast({ message: 'Enter both scores before marking a match completed or forfeit.', type: 'error' });
      return;
    }
    void persist(match, fd, status, 'Result saved.');
  };

  const markCancelled = (match: MatchPageItemDto) => {
    const fd = new FormData();
    fd.set('status', 'cancelled');
    fd.set('homeScore', match.homeScore === null ? '' : String(match.homeScore));
    fd.set('awayScore', match.awayScore === null ? '' : String(match.awayScore));
    void persist(match, fd, 'cancelled', 'Match marked cancelled.');
  };

  const groups = useMemo(() => groupMatchesByDay(items), [items]);
  const selectedVisible = useMemo(() => items.filter((m) => selectedIds.has(m.id)), [items, selectedIds]);
  const selectedCount = selectedVisible.length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkOpen(false);
    setBulkError(null);
  };
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(items.map((m) => m.id)));

  const confirmBulkDelete = async () => {
    if (bulkPending || selectedCount === 0) return;
    const ids = selectedVisible.map((m) => m.id);
    setBulkPending(true);
    setBulkError(null);
    try {
      const res = await deleteMatches(ids);
      if (!res.success) {
        setBulkError(res.error || 'Could not delete the selected matches.');
        return;
      }
      const gone = new Set(ids);
      setItems((prev) => prev.filter((m) => !gone.has(m.id)));
      setToast({ message: `${res.deleted ?? ids.length} ${(res.deleted ?? ids.length) === 1 ? 'match' : 'matches'} deleted.`, type: 'success' });
      void refreshCounts();
      exitSelectMode();
    } catch {
      setBulkError('Could not delete the selected matches.');
    } finally {
      setBulkPending(false);
    }
  };
  const resetMore = () => {
    setDivision(DEFAULT_MATCH_FACETS.division);
    setSort(DEFAULT_MATCH_FACETS.sort);
  };

  const scoreInput = cx(input, 'h-11 w-20 text-center text-lg font-semibold tabular-nums sm:h-10');

  return (
    <AdminPage>
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
      <AdminPageHeader
        route="/admin/matches"
        back={back}
        description="Enter results for matches that have been played, and schedule what is next."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={selectMode}
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className={cx(selectMode ? primaryBtn : secondaryBtn, 'max-sm:h-11')}
            >
              <HiOutlineCheckCircle aria-hidden className="h-4 w-4" />
              {selectMode ? 'Done selecting' : 'Select'}
            </button>
            <button type="button" onClick={() => setGenerateOpen(true)} className={cx(secondaryBtn, 'max-sm:h-11')}>
              <HiOutlineCalendarDays aria-hidden className="h-4 w-4" />
              Generate season
            </button>
            <button type="button" onClick={() => setScheduleOpen(true)} className={cx(primaryBtn, 'max-sm:h-11')}>
              <HiPlus aria-hidden className="h-4 w-4" />
              Schedule match
            </button>
          </div>
        }
      />

      <ScheduleMatchDialog
        isOpen={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={() => {
          setToast({ message: 'Match scheduled.', type: 'success' });
          reload();
        }}
        {...scheduleForm}
      />

      <GenerateSeasonDialog
        isOpen={generateOpen}
        onOpenChange={setGenerateOpen}
        games={games}
        seasons={seasons}
        schools={generateSchools}
        onGenerated={(message) => {
          setToast({ message, type: 'success' });
          reload();
        }}
      />

      {children}

      {/* Filters: the three most used stay visible; Division and Sort sit behind a disclosure. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Game" value={gameId} onChange={(e) => writeFilter({ game: e.target.value })} className={cx(selectClass, 'max-sm:h-11 max-sm:min-w-0 max-sm:flex-1')}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.shortName}</option>
            ))}
          </select>

          <select aria-label="Season" value={seasonId} onChange={(e) => writeFilter({ season: e.target.value })} className={cx(selectClass, 'max-sm:h-11 max-sm:min-w-0 max-sm:flex-1')}>
            <option value="">All seasons</option>
            {seasonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {gameId ? '' : `${gameMap.get(s.gameId)?.shortName} `}{s.name}{s.isActive ? ' (current)' : ''}
              </option>
            ))}
          </select>

          <AdminSearchField
            size="sm"
            className="w-full min-w-0 sm:w-56 sm:flex-none"
            aria-label="Search schools"
            placeholder="Search schools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />

          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-controls="match-more-filters"
            className={cx(ghostBtnSm, 'max-sm:h-11')}
          >
            More filters
            {moreActive && (
              <>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="sr-only">(active)</span>
              </>
            )}
          </button>

          {isRefetching && (
            <span role="status" className="ml-auto inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
              <AdminSpinner /> Loading…
            </span>
          )}
        </div>

        {moreOpen && (
          <div id="match-more-filters" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-admin-panel px-4 py-3">
            <label className="flex items-center gap-2 text-xs text-foreground-secondary">
              Division
              <select value={division} onChange={(e) => setDivision(e.target.value)} className={cx(selectClass, 'max-sm:h-11')}>
                <option value="">All divisions</option>
                <option value="Varsity">Varsity</option>
                <option value="JV">JV</option>
                <option value="All">All (individual)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground-secondary">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as MatchFacets['sort'])} className={cx(selectClass, 'max-sm:h-11')}>
                <option value="auto">Default for tab</option>
                <option value="asc">Oldest first</option>
                <option value="desc">Newest first</option>
              </select>
            </label>
            <button type="button" onClick={resetMore} disabled={!moreActive} className={cx(ghostBtnSm, 'max-sm:h-11')}>
              Reset
            </button>
          </div>
        )}
      </div>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          setTab(key as MatchTab);
          setEditingId(null);
        }}
        className="space-y-5"
      >
        <TabList aria-label="Match status" className="flex gap-1 overflow-x-auto border-b border-line/60">
          {MATCH_TABS.map((key) => {
            const count = counts?.[key];
            return (
              <Tab
                key={key}
                id={key}
                className={({ isSelected, isFocusVisible }) =>
                  cx(
                    '-mb-px inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm outline-none transition-colors duration-150',
                    isSelected ? 'border-accent font-semibold text-foreground' : 'border-transparent text-foreground-secondary hover:text-foreground',
                    isFocusVisible && 'ring-2 ring-inset ring-accent/60',
                  )
                }
              >
                {MATCH_TAB_LABELS[key]}
                {count !== undefined && (
                  <span
                    className={cx(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums leading-none',
                      key === 'needs-results' && count > 0 ? 'bg-warning/15 text-warning' : 'bg-surface-raised text-foreground-secondary',
                    )}
                  >
                    {count}
                    <span className="sr-only"> matches</span>
                  </span>
                )}
              </Tab>
            );
          })}
        </TabList>

        <TabPanel id={tab} className="outline-none">
          <div ref={listRef} tabIndex={-1} className="outline-none" aria-busy={isRefetching}>
            {refetchFailed && (
              <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-surface-sunken px-5 py-3 text-sm text-foreground">
                <span>Could not load matches for these filters.{scopeStale ? '' : ' Showing the previous results.'}</span>
                <button type="button" onClick={retry} className={secondaryBtnSm}>Retry</button>
              </div>
            )}

            {selectMode && !scopeStale && items.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-admin-panel px-4 py-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground sm:min-h-0">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer accent-accent"
                  />
                  Select all shown ({items.length})
                </label>
                <span role="status" className="text-sm text-foreground-secondary">
                  {selectedCount} selected
                </span>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={() => {
                    setBulkError(null);
                    setBulkOpen(true);
                  }}
                  className={cx(dangerBtn, 'max-sm:h-11 sm:ml-auto')}
                >
                  <HiOutlineTrash aria-hidden className="h-4 w-4" />
                  Delete selected ({selectedCount})
                </button>
              </div>
            )}

            {scopeStale || items.length === 0 ? (
              (scopeStale || isLoading || isStale) && !refetchFailed ? (
                <AdminSkeletonRows rows={5} />
              ) : scopeStale ? null : (
                <AdminEmptyState
                  compact
                  icon={<HiOutlineCalendarDays />}
                  title={EMPTY_COPY[loaded.tab].title}
                  description={EMPTY_COPY[loaded.tab].description}
                />
              )
            ) : (
              // Dimmed (not hidden) while a filter change loads, so the layout never jumps.
              <div className={cx('space-y-6 transition-opacity duration-200 motion-reduce:transition-none', (isLoading || isStale) && 'opacity-60')}>
                {groups.map((group) => {
                  const blockStarts = divisionBlockStarts(group.items);
                  return (
                  <section key={group.key} aria-labelledby={`day-${group.key}`}>
                    <h2 id={`day-${group.key}`} className="mb-2 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wider text-foreground-secondary">
                      {group.heading}
                      <span className="normal-case tracking-normal text-foreground-muted">
                        {group.items.length} {group.items.length === 1 ? 'match' : 'matches'}
                      </span>
                    </h2>
                    <ul className="divide-y divide-line/50 overflow-hidden rounded-2xl bg-admin-panel">
                      {group.items.map((match) => {
                        const blockStart = blockStarts.get(match.id);
                        const season = seasonMap.get(match.seasonId);
                        const game = season ? gameMap.get(season.gameId) : undefined;
                        const overdue = needsResult(match, now);
                        const scored = match.homeScore !== null && match.awayScore !== null;
                        const homeWon = scored && match.homeScore! > match.awayScore!;
                        const awayWon = scored && match.awayScore! > match.homeScore!;
                        const name = `${match.homeTeam} vs ${match.awayTeam}`;
                        const editing = editingId === match.id;
                        const saving = savingId === match.id;
                        const defaultStatus: MatchStatus = overdue ? 'completed' : match.status;
                        return (
                          <Fragment key={match.id}>
                          {blockStart && (
                            <li className="bg-surface-sunken/60 px-4 py-1.5 text-xs font-medium text-foreground-secondary">
                              {divisionLabel(blockStart.division)} · {blockStart.count} {blockStart.count === 1 ? 'match' : 'matches'}
                            </li>
                          )}
                          <li className={editing ? 'bg-surface-raised/40' : selectMode && selectedIds.has(match.id) ? 'bg-surface-raised/30' : undefined}>
                            <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto]">
                              <span className="flex items-center gap-3 text-sm font-medium tabular-nums text-foreground-secondary max-sm:order-1">
                                {selectMode && (
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${name}`}
                                    checked={selectedIds.has(match.id)}
                                    onChange={() => toggleSelected(match.id)}
                                    className="h-5 w-5 shrink-0 cursor-pointer accent-accent sm:h-4 sm:w-4"
                                  />
                                )}
                                {formatNY(new Date(match.scheduledAt), 'time-bare')}
                              </span>

                              <div className="min-w-0 max-sm:order-3 max-sm:col-span-2">
                                <p className="truncate text-sm text-foreground">
                                  <span className={homeWon ? 'font-bold' : 'font-medium'}>{match.homeTeam}</span>
                                  <span className="px-1.5 text-foreground-muted">vs</span>
                                  <span className={awayWon ? 'font-bold' : 'font-medium'}>{match.awayTeam}</span>
                                </p>
                                <p className="truncate text-xs text-foreground-secondary">
                                  {match.division}
                                  {!loaded.seasonId && season ? ` · ${game?.shortName ?? ''} ${season.name}`.trimEnd() : ''}
                                </p>
                              </div>

                              <div className="flex items-center justify-end gap-2 max-sm:order-2">
                                {scored && (
                                  <span className="text-sm font-semibold tabular-nums text-foreground">
                                    {match.homeScore} – {match.awayScore}
                                  </span>
                                )}
                                {overdue ? (
                                  <span className={chip('warning', 'sm')}>Needs result</span>
                                ) : (
                                  <span className={chip(STATUS_TONE[match.status], 'sm')}>{STATUS_LABEL[match.status]}</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 max-sm:order-4 max-sm:col-span-2">
                                <button
                                  id={`edit-${match.id}`}
                                  type="button"
                                  aria-expanded={editing}
                                  aria-label={`${overdue ? 'Enter result' : 'Edit'} for ${name}`}
                                  onClick={() => (editing ? closeEditor(match.id) : setEditingId(match.id))}
                                  className={cx(overdue ? primaryBtnSm : secondaryBtnSm, 'max-sm:h-11')}
                                >
                                  {overdue ? 'Enter result' : 'Edit'}
                                </button>
                                <MenuTrigger>
                                  <Button
                                    id={`more-${match.id}`}
                                    aria-label={`More actions for ${name}`}
                                    className={({ isFocusVisible }) =>
                                      cx(
                                        'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-secondary outline-none transition-colors duration-150 hover:bg-surface-raised hover:text-foreground data-[pressed]:bg-surface-raised',
                                        touchTarget,
                                        isFocusVisible && 'ring-2 ring-accent/60',
                                      )
                                    }
                                  >
                                    <HiOutlineEllipsisVertical aria-hidden className="h-5 w-5" />
                                  </Button>
                                  <Popover className="admin-popover w-52" placement="bottom end">
                                    <Menu
                                      aria-label={`Actions for ${name}`}
                                      className="rounded-xl bg-surface-raised p-1 shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none"
                                    >
                                      {match.status !== 'cancelled' && (
                                        <MenuItem
                                          id="cancel"
                                          textValue="Mark cancelled"
                                          onAction={() => markCancelled(match)}
                                          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground-secondary outline-none transition-colors data-[focused]:bg-surface data-[focused]:text-foreground sm:min-h-0"
                                        >
                                          <HiOutlineNoSymbol aria-hidden className="h-4 w-4" />
                                          Mark cancelled
                                        </MenuItem>
                                      )}
                                      <MenuItem
                                        id="delete"
                                        textValue="Delete match"
                                        onAction={() => {
                                          setDeleteTarget(match);
                                          setDeleteOpen(true);
                                        }}
                                        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground-secondary outline-none transition-colors data-[focused]:bg-red-950/30 data-[focused]:text-red-300 sm:min-h-0"
                                      >
                                        <HiOutlineTrash aria-hidden className="h-4 w-4" />
                                        Delete match…
                                      </MenuItem>
                                    </Menu>
                                  </Popover>
                                </MenuTrigger>
                              </div>
                            </div>

                            {editing && (
                              <form
                                aria-label={`Result for ${name}`}
                                onSubmit={handleSave(match)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    closeEditor(match.id);
                                  }
                                }}
                                className="flex flex-wrap items-end gap-x-4 gap-y-3 bg-surface-sunken px-4 py-4"
                              >
                                <div>
                                  <label htmlFor={`score-home-${match.id}`} className="mb-1 block max-w-40 truncate text-xs text-foreground-secondary">{match.homeTeam}</label>
                                  <input
                                    id={`score-home-${match.id}`}
                                    name="homeScore"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={match.homeScore ?? ''}
                                    placeholder="–"
                                    className={scoreInput}
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`score-away-${match.id}`} className="mb-1 block max-w-40 truncate text-xs text-foreground-secondary">{match.awayTeam}</label>
                                  <input
                                    id={`score-away-${match.id}`}
                                    name="awayScore"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={match.awayScore ?? ''}
                                    placeholder="–"
                                    className={scoreInput}
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`status-${match.id}`} className="mb-1 block text-xs text-foreground-secondary">Status</label>
                                  <select
                                    id={`status-${match.id}`}
                                    name="status"
                                    defaultValue={defaultStatus}
                                    className={cx(input, 'h-11 w-auto sm:h-10')}
                                  >
                                    {(Object.keys(STATUS_LABEL) as MatchStatus[]).map((s) => (
                                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2 sm:ml-auto">
                                  <button type="button" onClick={() => closeEditor(match.id)} disabled={saving} className={cx(ghostBtnSm, 'max-sm:h-11')}>
                                    Cancel
                                  </button>
                                  <button type="submit" disabled={saving} aria-busy={saving} className={cx(primaryBtnSm, 'max-sm:h-11')}>
                                    <PendingLabel pending={saving} label="Save result" pendingLabel="Saving…" />
                                  </button>
                                </div>
                              </form>
                            )}
                          </li>
                          </Fragment>
                        );
                      })}
                    </ul>
                  </section>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-center px-5 py-4">
              {scopeStale ? null : cursor ? (
                <button type="button" onClick={loadMore} disabled={isLoading || isStale} aria-busy={isLoading} className={cx(secondaryBtnSm, 'max-sm:h-11')}>
                  <PendingLabel pending={isLoading} label={`Load ${PAGE_SIZE} more`} pendingLabel="Loading…" />
                </button>
              ) : (
                <span className="text-xs text-foreground-secondary">
                  {items.length > 0 ? 'All matching fixtures loaded' : ''}
                </span>
              )}
            </div>
          </div>
        </TabPanel>
      </Tabs>

      <ConfirmActionDialog
        isOpen={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Delete ${selectedCount} ${selectedCount === 1 ? 'match' : 'matches'}?`}
        message={`This permanently deletes ${selectedCount} ${selectedCount === 1 ? 'match' : 'matches'}, along with their results, game data and reschedule requests. This cannot be undone.`}
        confirmLabel={`Delete ${selectedCount}`}
        pendingLabel="Deleting…"
        isPending={bulkPending}
        tone="danger"
        error={bulkError}
        onConfirm={() => void confirmBulkDelete()}
      />

      {/* One shared confirmation for the row menus' "Delete match…"; deletion stays explicit. */}
      <ConfirmDeleteButton
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && deleteTarget) {
            const id = deleteTarget.id;
            requestAnimationFrame(() => document.getElementById(`more-${id}`)?.focus());
          }
        }}
        action={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          await deleteMatch(id);
          setItems((prev) => prev.filter((m) => m.id !== id));
          setToast({ message: 'Match deleted.', type: 'success' });
          void refreshCounts();
          setRestoreFocusId(id);
        }}
        message={
          deleteTarget
            ? `Permanently delete this match (${deleteTarget.homeTeam} vs ${deleteTarget.awayTeam})? This also deletes its result, game data and reschedule requests. This cannot be undone.`
            : ''
        }
        label={deleteTarget ? `Delete match ${deleteTarget.homeTeam} vs ${deleteTarget.awayTeam}` : 'Delete match'}
      />
    </AdminPage>
  );
}
