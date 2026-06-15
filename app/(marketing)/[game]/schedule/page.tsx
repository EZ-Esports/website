import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import Link from 'next/link';

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
    ts: number;
    date: string;
    time: string;
    team1: string;
    team2: string;
    division: string;
    status: string;
    result?: string;
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
            team1: team1?.name || 'Home Team',
            team2: team2?.name || 'Away Team',
            division: homeRoster?.division || 'Varsity',
            status: m.status === 'completed' ? 'Completed' : m.status === 'live' ? 'Live' : 'Upcoming',
            result: m.status === 'completed' && m.homeScore !== null && m.awayScore !== null
              ? `${m.homeScore > m.awayScore ? 'W' : 'L'} ${m.homeScore}-${m.awayScore}`
              : undefined,
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

          {/* Schedule List — split into Upcoming (chronological) and Results (most recent first) */}
          {(() => {
            const upcoming = schedule
              .filter((m) => m.status !== 'Completed')
              .sort((a, b) => a.ts - b.ts);
            const results = schedule
              .filter((m) => m.status === 'Completed')
              .sort((a, b) => b.ts - a.ts);

            const renderCard = (match: ScheduleItem, index: number) => (
              <div
                key={index}
                className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-xs text-slate-400 font-semibold mb-1">
                    {match.date} • {match.time} • {match.division} Division
                  </div>
                  <div className="text-lg font-bold text-white tracking-tight">
                    {match.team1} <span className="text-slate-500 font-medium px-1">vs</span> {match.team2}
                  </div>
                </div>
                <div className="text-right">
                  {match.status === 'Completed' ? (
                    <span className="inline-block px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 text-ez-pink text-sm font-extrabold">
                      {match.result}
                    </span>
                  ) : match.status === 'Live' ? (
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-extrabold animate-pulse motion-reduce:animate-none">
                      Live
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800/60 text-slate-400 text-xs font-semibold">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            );

            if (schedule.length === 0) {
              return (
                <div className="text-center p-12 text-slate-500 text-sm bg-slate-900/30 border border-slate-800/60 rounded-xl">
                  No scheduled match fixtures for this season and division yet.
                </div>
              );
            }

            return (
              <div className="space-y-10">
                {upcoming.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Upcoming</h3>
                    <div className="space-y-4">{upcoming.map(renderCard)}</div>
                  </section>
                )}
                {results.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Results</h3>
                    <div className="space-y-4">{results.map(renderCard)}</div>
                  </section>
                )}
              </div>
            );
          })()}
        </div>
      </ContentSection>
    </main>
  );
}
