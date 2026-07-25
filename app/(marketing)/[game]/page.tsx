import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { GAMES, GAME_SLUGS, ROUTES, getGameRoute, getGameSubRoute } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import Tile from '@/app/components/ui/Tile';
import Badge, { resultVariant } from '@/app/components/ui/Badge';
import FilterTabs from '@/app/components/ui/FilterTabs';
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
  searchParams?: Promise<{ division?: string }>;
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
export default async function GameHubPage({ params, searchParams }: GameHubPageProps) {
  const { game } = await params;
  const { division: divisionParam } = (await searchParams) ?? {};
  const gameConfig = GAMES[game as GameSlug];
  const slug = game as GameSlug;

  // The query validates `divisionParam` against the divisions the season really
  // fields and echoes back the one it served, so the tabs highlight what the
  // page is showing rather than what the URL asked for.
  const { nextMatch, recentResults, topTeams, seasonName, divisions, division } =
    await getGameHubData(slug, divisionParam);

  const lastResult = recentResults[0] ?? null;
  const olderResults = recentResults.slice(1);

  /**
   * Tile spans are planned by simulating CSS grid's row-flow auto-placement
   * (see `app/lib/game-hub-layout.ts`), because "cells consumed so far" says
   * nothing about how many columns are contiguously free at the flow cursor.
   * The planner guarantees every data state fills its grid completely.
   */
  const tileLayout = planGameHubLayout({
    hasStandings: topTeams.length > 0,
    hasNextMatch: nextMatch !== null,
    recentResultsCount: recentResults.length,
  });

  /**
   * Which tiles render is decided by the planner and read back here, never
   * re-derived from the data — the planner's packing guarantee is only worth
   * anything if the page renders exactly the set it planned. `spanClass`
   * returns undefined for a tile that wasn't planned, so it doubles as the
   * render gate.
   */
  const spanClass = (id: GameHubTileId): string | undefined => {
    const tile = tileLayout.find((entry) => entry.id === id);
    if (!tile) return undefined;
    return cx(SM_COL_SPAN[tile.smColSpan], LG_COL_SPAN[tile.colSpan], LG_ROW_SPAN[tile.rowSpan]);
  };
  const seasonSummarySpan = spanClass('season-summary');
  const nextMatchSpan = spanClass('next-match');
  const standingsSpan = spanClass('standings');
  const lastResultSpan = spanClass('last-result');
  const recentResultsSpan = spanClass('recent-results');
  const archivesSpan = spanClass('archives');

  const themeStyle: GameThemeStyle = {
    '--game-accent': gameConfig.accent.color,
    '--game-accent-soft': `color-mix(in srgb, ${gameConfig.accent.color} 12%, transparent)`,
    '--game-accent-strong': `color-mix(in srgb, ${gameConfig.accent.color} 22%, transparent)`,
    '--game-accent-line': `color-mix(in srgb, ${gameConfig.accent.color} 40%, transparent)`,
  };

  // Divisions are a switch, not a label: a hub that fields both shows one
  // division at a time, so listing them as pills as well would say twice what
  // the tabs already say once — and only the tabs say which one you're reading.
  const divisionTabs = divisions.map((value) => ({
    label: divisionLabel(value),
    value,
    // Varsity is the default the query falls back to, so it owns the bare URL.
    href: value === 'Varsity' ? getGameRoute(slug) : `${getGameRoute(slug)}?division=${value}`,
  }));

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
              {/* The season the hub resolved is an active one by construction,
                  so it carries the live marker — the same green "Active" signal
                  SeasonSelect puts on this flag. Retiring a season in Admin →
                  League Setup is what takes the marker down. */}
              {seasonName && (
                <Badge variant="success" dot>
                  {seasonName} · In progress
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Only a season that actually fields both divisions gets a switch. */}
        {divisionTabs.length > 1 && (
          <FilterTabs
            tabs={divisionTabs}
            active={division}
            ariaLabel="Division"
            className="mb-5 flex-wrap"
          />
        )}

        <MigrationNotice />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* `getGameHubData` only ever resolves a season with `isActive` set,
              so a season named here is in progress by construction — the same
              claim SeasonSelect and ArchiveCommandDeck make from the same flag.
              A season that has finished is retired in Admin → League Setup; the
              page must not second-guess that flag with hedged copy.

              What it must not do is infer anything the flag doesn't say. With
              no active season there is no statement to make: data still being
              ported from the old site, a division between seasons and a failed
              query are indistinguishable from here, so it reports the absence
              and nothing more. */}
          {seasonSummarySpan && (
            <Tile title="This season" tone="accent" className={seasonSummarySpan}>
              {/* The badge above already names the season and marks it live;
                  repeating that here said the same thing twice on one screen.
                  This line answers the question the badge leaves open — why
                  the grid below is empty — without inferring a cause. */}
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {seasonName
                  ? `No ${divisionLabel(division)} data published yet.`
                  : 'Nothing to show here yet.'}
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

          {/* `nextMatch &&` is TypeScript narrowing, not a second opinion on
              whether the tile renders — `nextMatchSpan` already decided that. */}
          {nextMatchSpan && nextMatch && (
            // The dominant tile of the grid: the planner gives it the full
            // width, and the `feature` tone carries the game's accent as a
            // stronger tint plus a solid edge.
            <Tile title="Next match" tone="feature" className={nextMatchSpan}>
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

          {standingsSpan && (
            <Tile
              // Named for the division on screen: this table was always
              // Varsity-only, while the page implied it covered both.
              title={`${divisionLabel(division)} standings`}
              href={`${getGameSubRoute(slug, 'standings')}?division=${division}`}
              linkLabel="Full table"
              flush
              className={standingsSpan}
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

          {lastResultSpan && lastResult && (
            <Tile title="Last result" className={lastResultSpan}>
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

          {recentResultsSpan && (
            <Tile
              title="Recent results"
              href={getGameSubRoute(slug, 'schedule')}
              linkLabel="All matches"
              className={recentResultsSpan}
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
                      {/* Not `truncate`: `teams` reads "<home> vs. <away>", and
                          at 390px the row leaves ~228px for it, so clipping
                          took the opponent — the one name that makes the row
                          worth reading — with no tooltip to recover it. */}
                      <p className="text-sm font-bold leading-snug text-foreground">{match.teams}</p>
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
            className={archivesSpan}
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
