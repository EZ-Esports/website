'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { cx } from '@/app/lib/cx';
import Card from '@/app/components/ui/Card';
import type { GameAccent, GameSlug } from '@/app/types';

export interface ArchiveSeason {
  id: string;
  name: string;
  isActive: boolean;
  gameSlug: string;
  matchCount: number;
  /** Player name for individual-format divisions (e.g. TFT), otherwise the school name. Null while a season is still in progress. */
  champion: string | null;
  /** Always the champion's school (never a player name). Null while a season is still in progress. */
  championSchool: string | null;
}

export interface ArchiveGameGroup {
  slug: GameSlug;
  displayName: string;
  accent: GameAccent;
  /** Newest season first, matching getArchiveIndex()'s sort order. */
  seasons: ArchiveSeason[];
}

interface ArchiveCommandDeckProps {
  games: ArchiveGameGroup[];
}

/** CSS custom properties threaded through as inline style so Tailwind arbitrary-value utilities (bg-[var(--game)], etc.) can consume them. */
type GameThemeStyle = CSSProperties & {
  '--game': string;
  '--game-on': string;
};

const CHART_HEIGHT_PX = 56;

const GAME_ICONS: Record<GameSlug, ReactNode> = {
  valorant: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx={12} cy={12} r={9} />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </svg>
  ),
  'league-of-legends': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    </svg>
  ),
  'team-fight-tactics': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M9 4h6M10 4c0 2.5-2.5 3-2.5 5.5S9 13 9 13h6s1.5-1 1.5-3.5S14 6.5 14 4M7 20h10M8 20c.3-3 1.5-4.5 1.5-4.5S9 14 9 13h6s-.5 1-.5 2.5S16 17 16.5 20" />
    </svg>
  ),
};

function championDisplay(season: ArchiveSeason): string {
  if (season.champion) return season.champion;
  return season.isActive ? 'In progress' : '—';
}

export default function ArchiveCommandDeck({ games }: ArchiveCommandDeckProps) {
  const [activeSlug, setActiveSlug] = useState<GameSlug>(games[0]?.slug ?? 'valorant');
  const panelId = useId();

  const active = games.find((g) => g.slug === activeSlug) ?? games[0];
  if (!active) return null;

  const seasons = active.seasons;
  const chronological = [...seasons].reverse();
  const maxMatches = Math.max(1, ...seasons.map((s) => s.matchCount));
  const totalMatches = seasons.reduce((sum, s) => sum + s.matchCount, 0);
  const championSchools = new Set(seasons.map((s) => s.championSchool).filter((s): s is string => Boolean(s)));

  const themeStyle: GameThemeStyle = {
    '--game': active.accent.color,
    '--game-on': active.accent.on,
  };

  return (
    <div style={themeStyle}>
      {/* Segmented game switcher */}
      <div role="tablist" aria-label="Game" className="flex gap-1.5 p-1.5 bg-surface-raised border border-line rounded-xl mb-5">
        {games.map((game) => {
          const isActive = game.slug === activeSlug;
          return (
            <button
              key={game.slug}
              type="button"
              role="tab"
              id={`archive-tab-${game.slug}`}
              aria-selected={isActive}
              aria-controls={panelId}
              aria-label={game.displayName}
              onClick={() => setActiveSlug(game.slug)}
              className={cx(
                'flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg cursor-pointer select-none',
                'text-xs font-black uppercase tracking-wide transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised',
                isActive
                  ? 'bg-[var(--game)] text-[var(--game-on)]'
                  : 'text-foreground-secondary hover:text-foreground'
              )}
            >
              <span className={cx('w-3.5 h-3.5 shrink-0', isActive ? 'opacity-100' : 'opacity-80')}>
                {GAME_ICONS[game.slug]}
              </span>
              <span className="hidden sm:inline">{game.displayName}</span>
              <span
                className={cx(
                  'tabular-nums font-bold text-[11px]',
                  isActive ? 'opacity-85' : 'opacity-65'
                )}
              >
                {game.seasons.length}
              </span>
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`archive-tab-${active.slug}`}>
        {/* Dashboard row: 3 stat tiles + matches-per-season chart */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr] gap-3 mb-3.5">
          <Card padding="sm" className="flex flex-col justify-center gap-1 rounded-xl">
            <span className="text-2xl font-black tabular-nums leading-none">{seasons.length}</span>
            <span className="text-[10.5px] uppercase tracking-wider text-foreground-muted font-bold">Seasons tracked</span>
          </Card>
          <Card padding="sm" className="flex flex-col justify-center gap-1 rounded-xl">
            <span className="text-2xl font-black tabular-nums leading-none">{totalMatches.toLocaleString()}</span>
            <span className="text-[10.5px] uppercase tracking-wider text-foreground-muted font-bold">Matches logged</span>
          </Card>
          <Card padding="sm" className="flex flex-col justify-center gap-1 rounded-xl">
            <span className="text-2xl font-black tabular-nums leading-none">{championSchools.size}</span>
            <span className="text-[10.5px] uppercase tracking-wider text-foreground-muted font-bold">Champion schools</span>
          </Card>

          <Card padding="sm" className="flex flex-col rounded-xl">
            <span className="text-[10.5px] uppercase tracking-wider text-foreground-muted font-bold mb-2">
              Matches per season
            </span>
            <div className="flex-1 flex items-end gap-2 relative" style={{ minHeight: CHART_HEIGHT_PX }}>
              <div className="absolute left-0 right-0 bottom-[22px] h-px bg-line" aria-hidden="true" />
              {chronological.map((season) => {
                const heightPx = Math.max(4, Math.round((season.matchCount / maxMatches) * CHART_HEIGHT_PX));
                return (
                  <div key={season.id} className="flex-1 flex flex-col items-center gap-1.5 relative">
                    {season.isActive && (
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-wide text-[var(--game)] whitespace-nowrap">
                        Now
                      </span>
                    )}
                    <div
                      className={cx('w-full max-w-[26px] rounded-t rounded-b-sm', season.isActive ? 'bg-[var(--game)]' : 'bg-foreground-muted')}
                      style={{ height: heightPx }}
                      aria-hidden="true"
                    />
                    <span
                      className={cx(
                        'text-[9.5px] font-bold tabular-nums',
                        season.isActive ? 'text-foreground-secondary' : 'text-foreground-muted'
                      )}
                    >
                      {/* Assumes season.name is "YYYY-YY" (e.g. "2024-25"); a non-standard name will produce a blank/wrong axis label. */}
                      {season.name.slice(2, 4)}
                    </span>
                  </div>
                );
              })}
              <span className="sr-only">
                Matches per season, oldest to newest:{' '}
                {chronological.map((s) => `${s.name}: ${s.matchCount}`).join(', ')}
              </span>
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <div role="table" aria-label={`${active.displayName} seasons`} className="border border-line rounded-2xl overflow-hidden">
          <div
            role="row"
            className="hidden sm:grid grid-cols-[84px_1fr_1fr_120px_192px] gap-3 px-5 py-2.5 bg-surface-sunken border-b border-line text-[10px] font-black uppercase tracking-wider text-foreground-muted"
          >
            <span role="columnheader">Season</span>
            <span role="columnheader">Champion</span>
            <span role="columnheader">Matches</span>
            <span role="columnheader">Volume</span>
            <span role="columnheader" aria-hidden="true" />
          </div>

          {seasons.map((season, index) => {
            const pct = Math.round((season.matchCount / maxMatches) * 100);
            const scheduleHref = `/${season.gameSlug}/schedule?season=${encodeURIComponent(season.name)}`;
            const standingsHref = `/${season.gameSlug}/standings?season=${encodeURIComponent(season.name)}`;
            return (
              <div
                key={season.id}
                role="row"
                className={cx(
                  'grid grid-cols-1 sm:grid-cols-[84px_1fr_1fr_120px_192px] gap-2 sm:gap-3 sm:items-center',
                  'px-5 py-3.5 hover:bg-surface-raised transition-colors',
                  index < seasons.length - 1 && 'border-b border-line'
                )}
              >
                <span role="cell" className="text-[14.5px] font-black tabular-nums">
                  <span className="whitespace-nowrap">{season.name}</span>
                  {season.isActive && (
                    <span className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide align-middle bg-[var(--game)] text-[var(--game-on)]">
                      Current
                    </span>
                  )}
                </span>
                <span role="cell" className="text-[13px] font-bold text-foreground-secondary truncate">
                  {championDisplay(season)}
                </span>
                <span role="cell" className="text-[13px] tabular-nums text-foreground-muted">
                  {season.matchCount}
                </span>
                <div role="cell" className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--game)]"
                      style={{ width: `${pct}%`, minWidth: 3 }}
                    />
                  </div>
                  <span className="text-[11.5px] font-bold tabular-nums text-foreground-muted w-[34px] text-right">
                    {season.matchCount}
                  </span>
                </div>
                <div role="cell" className="flex gap-1.5 justify-start sm:justify-end">
                  <Link
                    href={scheduleHref}
                    className="px-2.5 py-1.5 rounded-md border border-line text-foreground-secondary text-[10.5px] font-black uppercase tracking-wide whitespace-nowrap transition-colors hover:border-[var(--game)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Schedule
                  </Link>
                  <Link
                    href={standingsHref}
                    className="px-2.5 py-1.5 rounded-md border border-line text-foreground-secondary text-[10.5px] font-black uppercase tracking-wide whitespace-nowrap transition-colors hover:border-[var(--game)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Standings
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
