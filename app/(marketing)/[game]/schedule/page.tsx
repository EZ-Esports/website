import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import FilterTabs from '@/app/components/ui/FilterTabs';
import Button from '@/app/components/ui/Button';
import { getMatchesPage, getSeasonMatches, getSeasonsWithGames } from '@/app/lib/db/queries';
import { normalizeSort, resolveSelectedSeason, toMatchesPageDto, toScheduleCalendarItem } from '@/app/lib/db/match-page';
import CalendarSchedule from './CalendarSchedule';
import ArchiveMatchList from './ArchiveMatchList';
import SeasonSelect from '@/app/components/ui/SeasonSelect';
import MigrationNotice from '@/app/components/ui/MigrationNotice';


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

  // No try/catch here: a failed query should surface as a real error, not
  // silently collapse into these same empty-state defaults. The marketing
  // route's error boundary (`app/(marketing)/error.tsx`) handles it instead.
  const seasons = (await getSeasonsWithGames()).filter((s) => s.gameSlug === game);

  const selectedSeason = resolveSelectedSeason(seasons, seasonParam);
  const isArchived = Boolean(selectedSeason && !selectedSeason.isActive);

  // Active season -> full-season calendar; archived -> lazy-loaded list.
  let calendarMatches: Awaited<ReturnType<typeof getSeasonMatches>> = [];
  let archivePage: Awaited<ReturnType<typeof getMatchesPage>> = { items: [], nextCursor: null };
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

  const schedule = calendarMatches.map(toScheduleCalendarItem);

  const filterHref = (d: string, s: string) =>
    `/${game}/schedule?division=${d}${selectedSeason ? `&season=${encodeURIComponent(selectedSeason.name)}` : ''}&sort=${s}`;

  return (
    <main>
      <Section>
        <SectionHeader
          as="h1"
          title={`${gameConfig.displayName} Schedule`}
          lead={
            isArchived
              ? `Archived results from the ${selectedSeason?.name} season`
              : 'View all scheduled matches for the current season'
          }
        />
        <p className="text-xs text-foreground-muted -mt-8 mb-8 text-center font-medium">
          All match times are Eastern Time (ET).
        </p>
        {/* A failed fetch now throws and hits the route's error boundary, so
            an empty schedule here is a real "nothing yet", the only case
            left where this notice is warranted. */}
        {(!selectedSeason || (calendarMatches.length === 0 && archivePage.items.length === 0)) && (
          <MigrationNotice />
        )}

        {/* Filters: division tabs, season picker, sort (archive only) */}
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <FilterTabs
            tabs={['Varsity', 'JV'].map((d) => ({
              label: d === 'JV' ? 'Junior Varsity' : d,
              value: d,
              href: filterHref(d, sort),
            }))}
            active={division}
            ariaLabel="Division"
          />

          {seasons.length > 1 && selectedSeason && (
            <SeasonSelect
              basePath={`/${game}/schedule`}
              seasons={seasons.map((s) => ({ name: s.name, isActive: s.isActive }))}
              selected={selectedSeason.name}
              extraParams={{ division, sort }}
            />
          )}

          {isArchived && (
            <Button href={filterHref(division, sort === 'desc' ? 'asc' : 'desc')} variant="outline">
              {sort === 'desc' ? 'Newest first ↓' : 'Oldest first ↑'}
            </Button>
          )}
        </div>

        {!selectedSeason ? (
          <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
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
      </Section>
    </main>
  );
}
