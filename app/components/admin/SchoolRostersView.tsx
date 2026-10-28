'use client';

import { useEffect, useMemo, useState } from 'react';
import { HiChevronDown, HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineUsers } from 'react-icons/hi2';
import {
  buildGameOptions,
  defaultExpandedKeys,
  mergeRosterFilterQuery,
  type DivisionColumn,
  type DivisionFilter,
  type PhoneDivision,
  type RosterEditOptions,
  type RosterViewFilters,
  type RosterViewRoster,
  type SeasonBlock,
} from '@/app/lib/school-roster-view';
import { AdminEmptyState, AdminToast } from '@/app/components/admin/AdminUI';
import {
  AddPlayerButton,
  AddPlayerPanel,
  AddRosterControl,
  DeleteRosterButton,
  PlayerEditForm,
  PlayerRowActions,
  RegisterTeamPanel,
  RosterEditForm,
  RosterEditProvider,
  useRosterEditRunner,
} from '@/app/components/admin/SchoolRosterEditors';
import ContentFlagBadge from '@/app/components/admin/ContentFlagBadge';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { chip, chipDot, focusRing, segmentedGroup, segmentedItem, selectClass } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';
import { MAX_ROSTER_PLAYERS } from '@/app/lib/onboarding/roster-limits';

interface SchoolRostersViewProps {
  schoolId: string;
  schoolName: string;
  blocks: SeasonBlock[];
  options: RosterEditOptions;
  /** Filters parsed and validated server-side from the URL. */
  initialFilters: RosterViewFilters;
}

const DIVISION_OPTIONS: { value: DivisionFilter; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'Varsity', label: 'Varsity' },
  { value: 'JV', label: 'JV' },
];

/**
 * Roster browser and editor for one school. The page denies everyone without
 * MANAGE_ROSTERS before rendering this, so edit controls never reach other
 * staff. Filters live in the URL (`?game=&division=&phone=`) so a reload or a
 * copied link restores the view.
 */
export default function SchoolRostersView({ schoolId, schoolName, blocks, options, initialFilters }: SchoolRostersViewProps) {
  const [gameSlug, setGameSlug] = useState<string>(initialFilters.game);
  const [division, setDivision] = useState<DivisionFilter>(initialFilters.division);
  // Phones never lay Varsity and JV side by side; this picks the one shown when the filter is "Both".
  const [phoneDivision, setPhoneDivision] = useState<PhoneDivision>(initialFilters.phone);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpandedKeys(blocks)));

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  useEffect(() => {
    if (!toast || toast.type === 'error') return; // errors linger so they can be read
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const runner = useRosterEditRunner((message, type) => setToast({ message, type }));
  const editCtx = { schoolId, options, ...runner };

  // Mirror the filters into the URL without a navigation or refetch; defaults stay out of it.
  useEffect(() => {
    const qs = mergeRosterFilterQuery(window.location.search, { game: gameSlug, division, phone: phoneDivision });
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [gameSlug, division, phoneDivision]);

  const games = useMemo(() => buildGameOptions(blocks), [blocks]);
  const visible = useMemo(() => (gameSlug ? blocks.filter((b) => b.gameSlug === gameSlug) : blocks), [blocks, gameSlug]);
  const hasDividedBlock = visible.some((b) => b.layout === 'divided');

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (blocks.length === 0) {
    return (
      <RosterEditProvider value={editCtx}>
        <div className="space-y-4">
          <AdminEmptyState
            icon={<HiOutlineUsers />}
            title={`${schoolName} has no teams yet.`}
            description="Register a team to enter this school in a game and season."
          />
          <RegisterTeamPanel />
          <AdminToast toast={toast} onDismiss={() => setToast(null)} />
        </div>
      </RosterEditProvider>
    );
  }

  return (
    <RosterEditProvider value={editCtx}>
    <div className="space-y-5">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
      <RegisterTeamPanel />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <label htmlFor="roster-game-filter" className="mb-1.5 block text-[13px] font-medium text-foreground-secondary">
            Game
          </label>
          <select
            id="roster-game-filter"
            value={gameSlug}
            onChange={(e) => setGameSlug(e.target.value)}
            className={cx(selectClass, 'min-w-48')}
          >
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <span id="roster-division-label" className="mb-1.5 block text-[13px] font-medium text-foreground-secondary">
            Division
          </span>
          <div role="group" aria-labelledby="roster-division-label" className={segmentedGroup}>
            {DIVISION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={division === o.value}
                onClick={() => setDivision(o.value)}
                className={segmentedItem(division === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {division === 'both' && hasDividedBlock && (
          <div className="md:hidden">
            <span id="roster-phone-division-label" className="mb-1.5 block text-[13px] font-medium text-foreground-secondary">
              Show on this screen
            </span>
            <div role="group" aria-labelledby="roster-phone-division-label" className={segmentedGroup}>
              {(['Varsity', 'JV'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={phoneDivision === d}
                  onClick={() => setPhoneDivision(d)}
                  className={cx(segmentedItem(phoneDivision === d), 'h-9')}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <AdminEmptyState compact icon={<HiOutlineUsers />} title="No teams for this game." />
      ) : (
        <div className="space-y-4">
          {visible.map((block) => (
            <SeasonBlockView
              key={block.key}
              block={block}
              division={division}
              phoneDivision={phoneDivision}
              open={expanded.has(block.key)}
              onToggle={() => toggle(block.key)}
            />
          ))}
        </div>
      )}
    </div>
    </RosterEditProvider>
  );
}

function SeasonBlockView({
  block,
  division,
  phoneDivision,
  open,
  onToggle,
}: {
  block: SeasonBlock;
  division: DivisionFilter;
  phoneDivision: PhoneDivision;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `season-panel-${block.key}`;
  const playerCount = block.rosters.reduce((n, r) => n + r.players.length, 0);

  return (
    <section
      className="rounded-2xl bg-admin-panel ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 hover:bg-surface-raised/40 hover:ring-accent/40 focus-within:ring-accent/40 motion-reduce:transition-none"
      aria-label={`${block.gameName} ${block.seasonName}`}
    >
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cx(
            'flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-5 py-3 text-left',
            focusRing,
          )}
        >
          <HiChevronDown
            aria-hidden
            className={cx('h-4 w-4 shrink-0 text-foreground-secondary transition-transform duration-150 motion-reduce:transition-none', !open && '-rotate-90')}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-foreground">{block.seasonName}</span>
            <span className="block text-sm text-foreground-secondary">
              {block.gameName} &middot; {playerCount} {playerCount === 1 ? 'player' : 'players'}
            </span>
          </span>
          <span className="flex flex-wrap items-center justify-end gap-2">
            {block.isActive && (
              <span className={chip('success')}>
                <span aria-hidden className={chipDot} />
                Active season
              </span>
            )}
            {block.rostersLocked ? (
              <span className={chip('warning')}>
                <HiOutlineLockClosed aria-hidden className="h-3.5 w-3.5" />
                Rosters locked
              </span>
            ) : (
              <span className={chip('neutral')}>
                <HiOutlineLockOpen aria-hidden className="h-3.5 w-3.5" />
                Rosters open
              </span>
            )}
          </span>
        </button>
      </h3>

      {open && (
        <div id={panelId} className="px-5 pb-5">
          <SeasonBody block={block} division={division} phoneDivision={phoneDivision} />
        </div>
      )}
    </section>
  );
}

function SeasonBody({
  block,
  division,
  phoneDivision,
}: {
  block: SeasonBlock;
  division: DivisionFilter;
  phoneDivision: PhoneDivision;
}) {
  return (
    <div className="space-y-4">
      {block.rostersLocked && (
        <p className="text-xs text-foreground-secondary">Locked for managers. Staff edits here still go through.</p>
      )}
      <SeasonColumns block={block} division={division} phoneDivision={phoneDivision} />
    </div>
  );
}

function SeasonColumns({
  block,
  division,
  phoneDivision,
}: {
  block: SeasonBlock;
  division: DivisionFilter;
  phoneDivision: PhoneDivision;
}) {
  // Tournament-model games keep their original shape: a plain list of the team's rosters,
  // never forced into Varsity/JV columns, so the division filter does not apply to them.
  if (block.layout === 'tournament') {
    return (
      <div className="space-y-3">
        <AddRosterControl block={block} division="All" />
        {block.rosters.length === 0 ? (
          <Placeholder>No rosters entered this season.</Placeholder>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {block.rosters.map((r) => (
              <RosterCard key={r.id} roster={r} block={block} showDivision />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Every other game: Varsity left, JV right. A game without a JV split keeps the JV side as a placeholder.
  const columns = division === 'both' ? block.columns : block.columns.filter((c) => c.division === division);
  return (
    <div className={cx('grid grid-cols-1 gap-4', division === 'both' && 'md:grid-cols-2')}>
      {columns.map((c) => (
        <ColumnView
          key={c.division}
          column={c}
          block={block}
          className={division === 'both' && c.division !== phoneDivision ? 'max-md:hidden' : undefined}
        />
      ))}
    </div>
  );
}

function ColumnView({ column, block, className }: { column: DivisionColumn; block: SeasonBlock; className?: string }) {
  return (
    <div className={cx('min-w-0 space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{column.division}</h4>
        {/* No JV split for this game: never offer JV creation, even if a legacy JV roster exists (server refuses it). */}
        {column.supported && (column.division === 'Varsity' || block.jvSupported) && <AddRosterControl block={block} division={column.division} />}
      </div>
      {column.missing ? (
        <Placeholder>{column.supported ? `No ${column.division} team this season` : 'No JV for this season'}</Placeholder>
      ) : (
        column.rosters.map((r) => <RosterCard key={r.id} roster={r} block={block} />)
      )}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line/70 px-4 py-8 text-center text-sm text-foreground-secondary">
      {children}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { captain: 'Captain', player: 'Player', coach: 'Coach', sub: 'Sub' };

function RosterCard({ roster, block, showDivision = false }: { roster: RosterViewRoster; block: SeasonBlock; showDivision?: boolean }) {
  const [panel, setPanel] = useState<'edit' | 'add' | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  // Rosters of the same team: a player can be moved between them but never across games or seasons.
  const siblings = block.rosters.filter((r) => r.id !== roster.id).map((r) => ({
    id: r.id,
    name: r.name,
    playerCount: r.players.length,
    subCount: r.players.filter((p) => p.role === 'sub').length,
  }));
  return (
    <div className="min-w-0 rounded-xl bg-surface-sunken p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h5 className="text-sm font-semibold text-foreground">{roster.name}</h5>
        {showDivision && <span className={chip('neutral', 'sm')}>Div {roster.division}</span>}
        <span className="text-xs text-foreground-secondary">
          {roster.players.length}/{MAX_ROSTER_PLAYERS} {roster.players.length === 1 ? 'player' : 'players'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <AddPlayerButton
            open={panel === 'add'}
            full={roster.players.length >= MAX_ROSTER_PLAYERS}
            playerCount={roster.players.length}
            onClick={() => setPanel(panel === 'add' ? null : 'add')}
          />
          <RowIconButton
            kind="edit"
            label={`Edit roster ${roster.name}`}
            aria-expanded={panel === 'edit'}
            onClick={() => setPanel(panel === 'edit' ? null : 'edit')}
          />
          <DeleteRosterButton roster={roster} />
        </div>
      </div>
      {panel === 'edit' && <RosterEditForm roster={roster} block={block} onClose={() => setPanel(null)} />}
      {panel === 'add' && <AddPlayerPanel roster={roster} seasonName={block.seasonName} onClose={() => setPanel(null)} />}
      {roster.players.length === 0 ? (
        <p className="text-sm text-foreground-secondary">No players on this roster.</p>
      ) : (
        <ul className="divide-y divide-line/50">
          {roster.players.map((p) => (
            <li key={p.id} className="py-2">
              {editingPlayer === p.id ? (
                <PlayerEditForm player={p} rosterName={roster.name} onClose={() => setEditingPlayer(null)} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{p.ign || p.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={chip(p.role === 'captain' ? 'accent' : 'neutral', 'sm')}>{ROLE_LABEL[p.role] ?? p.role}</span>
                      <PlayerRowActions player={p} rosterName={roster.name} siblings={siblings} onEdit={() => setEditingPlayer(p.id)} />
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-xs text-foreground-secondary">
                    {[
                      p.ign ? p.name : null,
                      p.discord ? `Discord: ${p.discord}` : null,
                      p.graduationYear ? `Class of ${p.graduationYear}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No further details'}
                  </p>
                  {p.contentFlags?.map((flag) => <ContentFlagBadge key={flag.id} flag={flag} who={p.name} />)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
