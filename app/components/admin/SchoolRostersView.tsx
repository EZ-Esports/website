'use client';

import { useMemo, useState } from 'react';
import { HiChevronDown, HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineUsers } from 'react-icons/hi2';
import {
  buildGameOptions,
  defaultExpandedKeys,
  filterBlocksByGame,
  type DivisionColumn,
  type DivisionFilter,
  type RosterViewRoster,
  type SeasonBlock,
} from '@/app/lib/school-roster-view';
import { AdminEmptyState, AdminNotice } from '@/app/components/admin/AdminUI';
import { chip, chipDot, focusRing, segmentedGroup, segmentedItem, selectClass } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';

interface SchoolRostersViewProps {
  schoolName: string;
  blocks: SeasonBlock[];
}

const DIVISION_OPTIONS: { value: DivisionFilter; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'Varsity', label: 'Varsity' },
  { value: 'JV', label: 'JV' },
];

/**
 * Read-only roster browser for one school. No controls here change data: the
 * only interactive elements are filters and season expand/collapse.
 */
export default function SchoolRostersView({ schoolName, blocks }: SchoolRostersViewProps) {
  const [gameId, setGameId] = useState<string>('');
  const [division, setDivision] = useState<DivisionFilter>('both');
  // Phones never lay Varsity and JV side by side; this picks the one shown when the filter is "Both".
  const [phoneDivision, setPhoneDivision] = useState<'Varsity' | 'JV'>('Varsity');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpandedKeys(blocks)));

  const games = useMemo(() => buildGameOptions(blocks), [blocks]);
  const visible = useMemo(() => filterBlocksByGame(blocks, gameId || null), [blocks, gameId]);
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
      <AdminEmptyState
        icon={<HiOutlineUsers />}
        title={`${schoolName} has no teams yet.`}
        description="Teams appear here once the school has entered a game in a season."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <label htmlFor="roster-game-filter" className="mb-1.5 block text-[13px] font-medium text-foreground-secondary">
            Game
          </label>
          <select
            id="roster-game-filter"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className={cx(selectClass, 'min-w-48')}
          >
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
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
  phoneDivision: 'Varsity' | 'JV';
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `season-panel-${block.key}`;
  const playerCount = block.rosters.reduce((n, r) => n + r.players.length, 0);

  return (
    <section className="rounded-2xl bg-admin-panel" aria-label={`${block.gameName} ${block.seasonName}`}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cx(
            'flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-5 py-3 text-left transition-colors duration-150 hover:bg-surface-raised/40',
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
  phoneDivision: 'Varsity' | 'JV';
}) {
  // Tournament-model games keep their original shape: a plain list of the team's rosters,
  // never forced into Varsity/JV columns, so the division filter does not apply to them.
  if (block.layout === 'tournament') {
    if (block.rosters.length === 0) return <Placeholder>No rosters entered this season.</Placeholder>;
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {block.rosters.map((r) => (
          <RosterCard key={r.id} roster={r} showDivision />
        ))}
      </div>
    );
  }

  if (block.layout === 'single') {
    if (division === 'JV') {
      return <AdminNotice tone="info">{block.gameName} has no JV division.</AdminNotice>;
    }
    return <ColumnView column={block.columns[0]} />;
  }

  const columns = division === 'both' ? block.columns : block.columns.filter((c) => c.division === division);
  return (
    <div className={cx('grid grid-cols-1 gap-4', division === 'both' && 'md:grid-cols-2')}>
      {columns.map((c) => (
        <ColumnView
          key={c.division}
          column={c}
          className={division === 'both' && c.division !== phoneDivision ? 'max-md:hidden' : undefined}
        />
      ))}
    </div>
  );
}

function ColumnView({ column, className }: { column: DivisionColumn; className?: string }) {
  return (
    <div className={cx('min-w-0 space-y-3', className)}>
      <h4 className="text-sm font-semibold text-foreground">{column.division}</h4>
      {column.missing ? (
        <Placeholder>No {column.division} team this season</Placeholder>
      ) : (
        column.rosters.map((r) => <RosterCard key={r.id} roster={r} />)
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

function RosterCard({ roster, showDivision = false }: { roster: RosterViewRoster; showDivision?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-sunken p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h5 className="text-sm font-semibold text-foreground">{roster.name}</h5>
        {showDivision && <span className={chip('neutral', 'sm')}>Div {roster.division}</span>}
        <span className="text-xs text-foreground-secondary">
          {roster.players.length} {roster.players.length === 1 ? 'player' : 'players'}
        </span>
      </div>
      {roster.players.length === 0 ? (
        <p className="text-sm text-foreground-secondary">No players on this roster.</p>
      ) : (
        <ul className="divide-y divide-line/50">
          {roster.players.map((p) => (
            <li key={p.id} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{p.ign || p.name}</span>
                <span className={chip(p.role === 'captain' ? 'accent' : 'neutral', 'sm')}>{ROLE_LABEL[p.role] ?? p.role}</span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
