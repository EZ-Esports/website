import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import Link from 'next/link';
import CalendarSchedule from './CalendarSchedule';

interface SchedulePageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ division?: string }>;
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
  const { division = 'Varsity' } = await searchParams;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface ScheduleItem {
    id: string;
    ts: number;
    date: string;
    time: string;
    scheduledAt: string;
    team1: string;
    team2: string;
    division: string;
    status: string;
    result?: string;
    homeScore: number | null;
    awayScore: number | null;
  }

  let schedule: ScheduleItem[] = [];
  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, game))
      .limit(1);

    if (gameRow[0]) {
      const activeSeason = await db
        .select()
        .from(schema.seasons)
        .where(and(eq(schema.seasons.gameId, gameRow[0].id), eq(schema.seasons.isActive, true)))
        .limit(1);

      if (activeSeason[0]) {
        const matchesList = await db
          .select()
          .from(schema.matches)
          .where(eq(schema.matches.seasonId, activeSeason[0].id))
          .orderBy(desc(schema.matches.scheduledAt));

        const teamsList = await db
          .select({
            id: schema.teams.id,
            schoolId: schema.teams.schoolId,
            gameId: schema.teams.gameId,
            seasonId: schema.teams.seasonId,
            name: schema.schools.name,
          })
          .from(schema.teams)
          .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
          .where(and(eq(schema.teams.gameId, gameRow[0].id), isNull(schema.schools.deletedAt)));

        const teamMap = new Map(teamsList.map((t) => [t.id, t]));
        const teamIds = teamsList.map((t) => t.id);

        const rostersList = teamIds.length > 0
          ? await db.select().from(schema.rosters).where(inArray(schema.rosters.teamId, teamIds))
          : [];

        const rosterMap = new Map(rostersList.map((r) => [r.id, r]));

        const allMapped = matchesList.map((m) => {
          const homeRoster = rosterMap.get(m.homeRosterId);
          const awayRoster = rosterMap.get(m.awayRosterId);
          const team1 = homeRoster ? teamMap.get(homeRoster.teamId) : null;
          const team2 = awayRoster ? teamMap.get(awayRoster.teamId) : null;
          return {
            id: m.id,
            ts: new Date(m.scheduledAt).getTime(),
            date: new Date(m.scheduledAt).toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            time: new Date(m.scheduledAt).toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
            }),
            scheduledAt: m.scheduledAt.toISOString(),
            team1: team1?.name || 'Home Team',
            team2: team2?.name || 'Away Team',
            division: homeRoster?.division || 'Varsity',
            status: m.status === 'completed' ? 'Completed' : m.status === 'live' ? 'Live' : 'Upcoming',
            result: m.status === 'completed' && m.homeScore !== null && m.awayScore !== null
              ? `${m.homeScore > m.awayScore ? 'W' : 'L'} ${m.homeScore}-${m.awayScore}`
              : undefined,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
          };
        });

        schedule = allMapped.filter((item) => item.division.toLowerCase() === division.toLowerCase());
      }
    }
  } catch (error) {
    console.error('Failed to load schedule from database', error);
  }

  return (
    <main>
      <h1 className="sr-only">{gameConfig.displayName} Schedule — EZ Esports</h1>
      <ContentSection
        heading={`${gameConfig.displayName} Schedule`}
        description="View all scheduled matches for the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Division Filter */}
          <div className="mb-8 flex gap-2">
            <Link
              href={`/${game}/schedule?division=Varsity`}
              className={`px-4 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg transition-all ${
                division === 'Varsity'
                  ? 'bg-ez-pink text-ez-black hover:bg-ez-pink/80'
                  : 'bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              Varsity
            </Link>
            <Link
              href={`/${game}/schedule?division=JV`}
              className={`px-4 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg transition-all ${
                division === 'JV'
                  ? 'bg-ez-pink text-ez-black hover:bg-ez-pink/80'
                  : 'bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              JV
            </Link>
          </div>

          {/* Interactive Calendar Component */}
          <CalendarSchedule
            key={`${game}-${division}`}
            matches={schedule}
            gameSlug={game}
            division={division}
          />
        </div>
      </ContentSection>
    </main>
  );
}

