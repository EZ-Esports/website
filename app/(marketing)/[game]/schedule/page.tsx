import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { getMatchesPage, getSeasonMatches, getSeasonsWithGames } from '@/app/lib/db/queries';
import { normalizeSort, resolveSelectedSeason, toMatchesPageDto } from '@/app/lib/db/match-page';
import Link from 'next/link';
import CalendarSchedule from './CalendarSchedule';
import ArchiveMatchList from './ArchiveMatchList';
import SeasonSelect from '@/app/components/ui/SeasonSelect';

interface SchedulePageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ division?: string; season?: string; sort?: string }>;
}

export async function generateMetadata({ params }: SchedulePageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} Schedule | EZ Esports`,
    description: `View all scheduled matches for the EZ Esports ${gameConfig.displayName} season.`,
  };
}

export default async function SchedulePage({ params, searchParams }: SchedulePageProps) {
  const { game } = await params;
  const { division = 'Varsity', season: seasonParam, sort: sortParam } = await searchParams;
  const sort = normalizeSort(sortParam);

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  let seasons: Awaited<ReturnType<typeof getSeasonsWithGames>> = [];
  try {
    seasons = (await getSeasonsWithGames()).filter((s) => s.gameSlug === game);
  } catch (error) {
    console.error('Failed to load seasons from database', error);
  }

  const selectedSeason = resolveSelectedSeason(seasons, seasonParam);
  const isArchived = Boolean(selectedSeason && !selectedSeason.isActive);

  // Active season -> full-season calendar; archived -> lazy-loaded list.
  let calendarMatches: Awaited<ReturnType<typeof getSeasonMatches>> = [];
  let archivePage: Awaited<ReturnType<typeof getMatchesPage>> = { items: [], nextCursor: null };
  try {
    if (selectedSeason && !isArchived) {
      calendarMatches = await getSeasonMatches(selectedSeason.id, division);
    } else if (selectedSeason) {
      archivePage = await getMatchesPage({
        seasonId: selectedSeason.id,
        division,
        sort,
        limit: 20,
      });
    }
  } catch (error) {
    console.error('Failed to load schedule from database', error);
  }

  const schedule = calendarMatches.map((m) => ({
    id: m.id,
    ts: m.scheduledAt.getTime(),
    date: m.scheduledAt.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: m.scheduledAt.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }),
    scheduledAt: m.scheduledAt.toISOString(),
    team1: m.homeTeam,
    team2: m.awayTeam,
    division: m.division,
    status: m.status === 'completed' ? 'Completed' : m.status === 'live' ? 'Live' : 'Upcoming',
    result:
      m.status === 'completed' && m.homeScore !== null && m.awayScore !== null
        ? `${m.homeScore > m.awayScore ? 'W' : 'L'} ${m.homeScore}-${m.awayScore}`
        : undefined,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  const filterHref = (d: string, s: string) =>
    `/${game}/schedule?division=${d}${selectedSeason ? `&season=${encodeURIComponent(selectedSeason.name)}` : ''}&sort=${s}`;

  return (
    <main>
      <h1 className="sr-only">{gameConfig.displayName} Schedule — EZ Esports</h1>
      <ContentSection
        heading={`${gameConfig.displayName} Schedule`}
        description={
          isArchived
            ? `Archived results from the ${selectedSeason?.name} season`
            : 'View all scheduled matches for the current season'
        }
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Filters: division tabs, season picker, sort (archive only) */}
          <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex gap-2">
              {['Varsity', 'JV'].map((d) => (
                <Link
                  key={d}
                  href={filterHref(d, sort)}
                  className={`px-4 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg transition-all ${
                    division === d
                      ? 'bg-ez-pink text-ez-black hover:bg-ez-pink/80'
                      : 'bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {d}
                </Link>
              ))}
            </div>

            {seasons.length > 1 && selectedSeason && (
              <SeasonSelect
                basePath={`/${game}/schedule`}
                seasons={seasons.map((s) => ({ name: s.name, isActive: s.isActive }))}
                selected={selectedSeason.name}
                extraParams={{ division, sort }}
              />
            )}

            {isArchived && (
              <Link
                href={filterHref(division, sort === 'desc' ? 'asc' : 'desc')}
                className="px-4 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
              >
                {sort === 'desc' ? 'Newest first ↓' : 'Oldest first ↑'}
              </Link>
            )}
          </div>

          {!selectedSeason ? (
            <div className="text-center p-12 text-slate-500 text-sm bg-slate-900/20 border border-slate-800/40 rounded-2xl">
              No seasons found for {gameConfig.displayName} yet.
            </div>
          ) : isArchived ? (
            <ArchiveMatchList
              key={`${selectedSeason.id}-${division}-${sort}`}
              seasonId={selectedSeason.id}
              division={division}
              sort={sort}
              initialItems={toMatchesPageDto(archivePage).items}
              initialCursor={archivePage.nextCursor}
            />
          ) : (
            <CalendarSchedule
              key={`${game}-${division}`}
              matches={schedule}
              gameSlug={game}
              division={division}
            />
          )}
        </div>
      </ContentSection>
    </main>
  );
}
