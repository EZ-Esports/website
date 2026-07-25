import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { GAMES, GAME_SLUGS, ROUTES, getGameSubRoute } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import Tile from '@/app/components/ui/Tile';
import Badge, { resultVariant } from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { Table, Th, Td, Tr } from '@/app/components/ui/Table';
import { getGameHubData } from '@/app/lib/db/queries';
import MigrationNotice from '@/app/components/ui/MigrationNotice';
import { cx } from '@/app/lib/cx';
import { planGameHubLayout, type GameHubTileId } from '@/app/lib/game-hub-layout';


const HUB_DESCRIPTIONS: Record<GameSlug, string> = {
  valorant:
    'Follow the EZ Esports Valorant league — standings, schedules, match results, and school rosters for NYC high-school Valorant competition.',
  'league-of-legends':
    'Follow the EZ Esports League of Legends division — standings, schedules, match results, and school rosters for NYC high-school League of Legends competition.',
  'team-fight-tactics':
    'Follow the EZ Esports Teamfight Tactics league — standings, schedules, match results, and school rosters for NYC high-school Teamfight Tactics competition.',
  osu:
    'Follow the EZ Esports osu! division — standings, schedules, match results, and school rosters for NYC high-school osu! competition.',
  minecraft:
    'Follow the EZ Esports Minecraft division — standings, schedules, match results, and school rosters for NYC high-school Minecraft competition.',
  tetris:
    'Follow the EZ Esports Tetris division — standings, schedules, match results, and school rosters for NYC high-school Tetris competition.',
};

const RANK_MEDALS: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

/**
 * Per-game CSS custom properties, consumed by `bg-[var(--game-accent)]` &co.
 *
 * `gameConfig.accent.on` is deliberately *not* plumbed: solid accent on this
 * page only ever carries non-text elements (the identity rule, the standings
 * leader bar, the chip dot). Small text sits on accent *tints* instead, where
 * the normal foreground tokens are what's legible — so a text-on-accent color
 * would be declared and never read.
 */
type GameThemeStyle = CSSProperties & {
  '--game-accent': string;
  '--game-accent-soft': string;
  '--game-accent-strong': string;
  '--game-accent-line': string;
};

/**
 * Grid spans as literal classes — Tailwind only generates what it can see in
 * the source, so these can never be assembled from a template string.
 */
const SM_COL_SPAN: Record<number, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
};
const LG_COL_SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
};
const LG_ROW_SPAN: Record<number, string> = {
  1: 'lg:row-span-1',
  2: 'lg:row-span-2',
};

const divisionLabel = (division: string): string =>
  division === 'JV' ? 'Junior Varsity' : division;

interface GameHubPageProps {
  params: Promise<{ game: string }>;
}

export async function generateMetadata({ params }: GameHubPageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} | EZ Esports`,
    description: HUB_DESCRIPTIONS[game as GameSlug],
  };
}

// Bad slugs are already 404'd by app/(marketing)/[game]/layout.tsx.
export default async function GameHubPage({ params }: GameHubPageProps) {
  const { game } = await params;
  const gameConfig = GAMES[game as GameSlug];
  const slug = game as GameSlug;

  const { record, jvRecord, nextMatch, recentResults, topTeams, seasonName } =
    await getGameHubData(slug);

  const divisions: string[] = [];
  if (record !== null) divisions.push('Varsity');
  if (jvRecord !== null) divisions.push('JV');

  const lastResult = recentResults[0] ?? null;
  const olderResults = recentResults.slice(1);
  // topTeams rows join the school name, so they double as the roster shortlist.
  const rosterSchools = topTeams.map((entry) => entry.team);

  const hasStandings = topTeams.length > 0;
  const hasNextMatch = nextMatch !== null;
  const hasRosters = rosterSchools.length > 0;
  const hasSeasonData = hasStandings || hasNextMatch || recentResults.length > 0;

  /**
   * Tile spans are planned by simulating CSS grid's row-flow auto-placement
   * (see `app/lib/game-hub-layout.ts`), because "cells consumed so far" says
   * nothing about how many columns are contiguously free at the flow cursor.
   * The planner guarantees every data state fills its grid completely.
   */
  const tileLayout = planGameHubLayout({
    hasStandings,
    hasNextMatch,
    recentResultsCount: recentResults.length,
    hasRosters,
  });
  const spanClass = (id: GameHubTileId): string => {
    const tile = tileLayout.find((entry) => entry.id === id);
    if (!tile) return '';
    return cx(SM_COL_SPAN[tile.smColSpan], LG_COL_SPAN[tile.colSpan], LG_ROW_SPAN[tile.rowSpan]);
  };

  const themeStyle: GameThemeStyle = {
    '--game-accent': gameConfig.accent.color,
    '--game-accent-soft': `color-mix(in srgb, ${gameConfig.accent.color} 12%, transparent)`,
    '--game-accent-strong': `color-mix(in srgb, ${gameConfig.accent.color} 22%, transparent)`,
    '--game-accent-line': `color-mix(in srgb, ${gameConfig.accent.color} 40%, transparent)`,
  };

  // One pill per division, each carrying the same long-form label the match
  // tiles use — a division must never appear under two names on one screen.
  // Separate pills rather than one joined pill so "Junior Varsity" can wrap to
  // its own line at 390px instead of blowing out a `whitespace-nowrap` badge.
  const metaPills = [seasonName, ...divisions.map(divisionLabel)];

  return (
    <div className="min-h-[60vh]" style={themeStyle}>
      {/* The fixed chrome on a game route is 138px tall, not the 88px that
          MainContentWrapper's pt-[88px] offsets: the 88px nav plus the ~50px
          GameSubHeader. This Section's top padding is what clears the rest, so
          it must stay >= 74px (88 + 74 - 138 = 24px of breathing room) at every
          breakpoint, or the accent rule and the h1 slide under the sub-header. */}
      <Section width="wide" className="pt-20 md:pt-24">
        {/* Identity row: accent rule + the page's only h1 + season context. It
            comes first so the game, not a system notice, is what a visitor reads
            first on the page. */}
        <div className="flex gap-4 sm:gap-5 mb-5">
          <span
            className="w-[3px] shrink-0 rounded-full bg-[var(--game-accent)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
              {gameConfig.displayName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {metaPills
                .filter((pill): pill is string => Boolean(pill))
                .map((pill) => (
                  <Badge key={pill} variant="neutral">
                    {pill}
                  </Badge>
                ))}
            </div>
          </div>
        </div>

        <MigrationNotice />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* An empty result set has three causes here — data not yet ported
              from the old site, a season with nothing renderable in it, or a
              failed query — and this page can't tell them apart. So it reports
              only the absence, never a conclusion about the league: no "new
              division", and no present-tense claim that a season is under way
              (the seasons still carrying `isActive` predate the migration). */}
          {!hasSeasonData && (
            <Tile title="This season" tone="accent" className={spanClass('season-summary')}>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {seasonName ? `Nothing to show for ${seasonName} yet.` : 'Nothing to show here yet.'}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">
                Standings, schedules and rosters appear here as this division&rsquo;s data is
                published.
              </p>
              {seasonName && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    href={getGameSubRoute(slug, 'standings')}
                    variant="outline"
                    className="min-h-[44px]"
                  >
                    Standings
                  </Button>
                  <Button
                    href={getGameSubRoute(slug, 'teams')}
                    variant="outline"
                    className="min-h-[44px]"
                  >
                    Teams &amp; rosters
                  </Button>
                </div>
              )}
            </Tile>
          )}

          {nextMatch && (
            // The dominant tile of the grid: the planner gives it the full
            // width, and the `feature` tone carries the game's accent as a
            // stronger tint plus a solid edge.
            <Tile title="Next match" tone="feature" className={spanClass('next-match')}>
              <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-foreground">
                {nextMatch.teams}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                  {nextMatch.date}
                </span>
                {/* Accent-tinted, not accent-filled: small text on a solid
                    per-game accent fails contrast for several of the games. */}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--game-accent-line)] bg-[var(--game-accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--game-accent)]"
                    aria-hidden="true"
                  />
                  {divisionLabel(nextMatch.division)}
                </span>
              </div>
              <Button
                href={getGameSubRoute(slug, 'schedule')}
                variant="outline"
                className="mt-5 min-h-[44px]"
              >
                Full schedule
              </Button>
            </Tile>
          )}

          {topTeams.length > 0 && (
            <Tile
              title="Standings"
              href={getGameSubRoute(slug, 'standings')}
              linkLabel="Full table"
              flush
              className={spanClass('standings')}
            >
              <Table>
                <thead className="border-b border-line">
                  <tr>
                    <Th>Rank</Th>
                    <Th>Team</Th>
                    <Th className="whitespace-nowrap">W&ndash;L</Th>
                    <Th align="right" className="hidden sm:table-cell">Win %</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {topTeams.map((entry, index) => (
                    <Tr key={entry.rank} interactive>
                      {/* The leader carries the game's accent — the one place
                          the table earns colour. */}
                      <Td
                        className={cx(
                          'font-bold whitespace-nowrap border-l-2',
                          index === 0 ? 'border-l-[var(--game-accent)]' : 'border-l-transparent'
                        )}
                      >
                        {RANK_MEDALS[entry.rank] && (
                          <span aria-hidden="true">{RANK_MEDALS[entry.rank]} </span>
                        )}
                        {entry.rank}
                      </Td>
                      <Td className="font-bold text-foreground">{entry.team}</Td>
                      <Td className="font-medium whitespace-nowrap">
                        {entry.wins}&ndash;{entry.losses}
                      </Td>
                      <Td className="hidden sm:table-cell font-bold text-foreground text-right whitespace-nowrap">
                        {(entry.winPct * 100).toFixed(1)}%
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Tile>
          )}

          {lastResult && (
            <Tile title="Last result" className={spanClass('last-result')}>
              <p className="text-sm font-bold leading-snug text-foreground">
                {lastResult.teams}
              </p>
              <p
                className={cx(
                  'mt-2 text-2xl font-black tracking-tight',
                  lastResult.result.startsWith('W') ? 'text-success' : 'text-foreground-secondary'
                )}
              >
                {lastResult.result}
              </p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-foreground-secondary">
                {lastResult.date} · {divisionLabel(lastResult.division)}
              </p>
            </Tile>
          )}

          {rosterSchools.length > 0 && (
            <Tile
              title="Rosters"
              href={getGameSubRoute(slug, 'teams')}
              linkLabel="All teams"
              className={spanClass('rosters')}
            >
              <ul className="space-y-2">
                {rosterSchools.map((school) => (
                  <li
                    key={school}
                    className="truncate text-sm font-semibold text-foreground-secondary"
                  >
                    {school}
                  </li>
                ))}
              </ul>
            </Tile>
          )}

          {olderResults.length > 0 && (
            <Tile
              title="Recent results"
              href={getGameSubRoute(slug, 'schedule')}
              linkLabel="All matches"
              className={spanClass('recent-results')}
            >
              <ul className="divide-y divide-line">
                {olderResults.map((match, index) => (
                  <li
                    key={`${match.date}-${match.teams}-${index}`}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-foreground-secondary">
                        {match.date} · {divisionLabel(match.division)}
                      </p>
                      <p className="truncate text-sm font-bold text-foreground">{match.teams}</p>
                    </div>
                    <Badge variant={resultVariant(match.result.startsWith('W'))} size="sm">
                      {match.result}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Tile>
          )}

          <Tile
            title="Season archives"
            href={ROUTES.archives}
            linkLabel="Archives"
            className={spanClass('archives')}
          >
            <p className="text-sm leading-relaxed text-foreground-secondary">
              {`Every past ${gameConfig.displayName} season in one place — final standings, champion schools, and the full match history behind them.`}
            </p>
          </Tile>
        </div>
      </Section>
    </div>
  );
}
