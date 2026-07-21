'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
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

function gameThemeStyle(game: Pick<ArchiveGameGroup, 'accent'>): GameThemeStyle {
  return {
    '--game': game.accent.color,
    '--game-on': game.accent.on,
  };
}

/** First letter of up to the first two words, e.g. "Bronx Science" -> "BS". */
function championInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .join('')
    .slice(0, 2);
  return initials || '?';
}

/** Circular initials badge (Leadership-page idiom, shrunk for an inline table cell) plus the champion name, with a muted school line when the champion is a player rather than the school itself (TFT-style individual divisions). */
function ChampionCell({ season }: { season: ArchiveSeason }) {
  const hasChampion = Boolean(season.champion);
  const isIndividual = hasChampion && Boolean(season.championSchool) && season.champion !== season.championSchool;

  return (
    <div role="cell" className="flex items-center gap-2.5 min-w-0">
      <div
        className={cx(
          'w-7 h-7 rounded-full shrink-0 flex items-center justify-center border-2 border-line',
          hasChampion ? 'bg-surface' : 'bg-transparent border-dashed'
        )}
        aria-hidden="true"
      >
        {hasChampion && (
          <span className="text-[9px] font-extrabold tracking-tight text-foreground">
            {championInitials(season.champion as string)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <span className="block text-[13px] font-bold text-foreground-secondary truncate">
          {championDisplay(season)}
        </span>
        {isIndividual && (
          <span className="block text-[10.5px] font-semibold text-foreground-muted truncate">
            {season.championSchool}
          </span>
        )}
      </div>
    </div>
  );
}

/** Stat row (3 tiles + matches-per-season chart) and season leaderboard for a single game, themed with that game's accent. */
function GameDashboard({ game }: { game: ArchiveGameGroup }) {
  const seasons = game.seasons;
  const chronological = [...seasons].reverse();
  const maxMatches = Math.max(1, ...seasons.map((s) => s.matchCount));
  const totalMatches = seasons.reduce((sum, s) => sum + s.matchCount, 0);
  const championSchools = new Set(seasons.map((s) => s.championSchool).filter((s): s is string => Boolean(s)));

  return (
    <div style={gameThemeStyle(game)}>
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
      <div role="table" aria-label={`${game.displayName} seasons`} className="border border-line rounded-2xl overflow-hidden">
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
              <ChampionCell season={season} />
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
  );
}

export default function ArchiveCommandDeck({ games }: ArchiveCommandDeckProps) {
  if (games.length === 0) return null;

  return (
    <Tabs defaultSelectedKey={games[0]!.slug}>
      {/* Game switcher: GameSubHeader idiom (accent dot + label, divider, pill tabs) driven by real Tabs selection state. */}
      <div className="flex items-center gap-3 sm:gap-4 px-4 py-2.5 bg-surface-raised border border-line rounded-xl mb-5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="text-xs font-black uppercase tracking-widest text-foreground-secondary hidden sm:inline">
            Filter by game
          </span>
        </div>
        <div className="w-px h-5 bg-line shrink-0 hidden sm:block" aria-hidden="true" />
        <TabList aria-label="Game" className="flex items-center gap-1.5">
          {games.map((game) => (
            <Tab
              key={game.slug}
              id={game.slug}
              aria-label={game.displayName}
              style={gameThemeStyle(game)}
              className={cx(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg cursor-pointer select-none outline-none',
                'text-xs font-black uppercase tracking-wide transition-colors duration-150 whitespace-nowrap',
                'text-foreground-secondary data-[hovered]:text-foreground data-[hovered]:bg-surface/60',
                'data-[selected]:bg-[var(--game)] data-[selected]:text-[var(--game-on)] data-[selected]:shadow-sm data-[selected]:data-[hovered]:bg-[var(--game)]',
                'data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--game)] data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-offset-surface-raised'
              )}
            >
              <span className="w-3.5 h-3.5 shrink-0 opacity-90">{GAME_ICONS[game.slug]}</span>
              <span className="hidden sm:inline">{game.displayName}</span>
              <span className="tabular-nums font-bold text-[11px] opacity-70">{game.seasons.length}</span>
            </Tab>
          ))}
        </TabList>
      </div>

      {games.map((game) => (
        <TabPanel key={game.slug} id={game.slug} className="outline-none">
          <GameDashboard game={game} />
        </TabPanel>
      ))}
    </Tabs>
  );
}
