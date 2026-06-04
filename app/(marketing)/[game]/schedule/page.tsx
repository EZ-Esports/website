import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

interface SchedulePageProps {
  params: Promise<{ game: string }>;
}

export default async function SchedulePage({ params }: SchedulePageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface ScheduleItem {
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
          .select()
          .from(schema.teams)
          .where(eq(schema.teams.gameId, gameRow[0].id));

        const teamMap = new Map(teamsList.map((t) => [t.id, t]));

        schedule = matchesList.map((m) => {
          const team1 = teamMap.get(m.homeTeamId);
          const team2 = teamMap.get(m.awayTeamId);
          return {
            date: new Date(m.scheduledAt).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            time: new Date(m.scheduledAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            }),
            team1: team1?.name || 'Home Team',
            team2: team2?.name || 'Away Team',
            division: team1?.division || 'Varsity',
            status: m.status === 'completed' ? 'Completed' : m.status === 'live' ? 'Live' : 'Upcoming',
            result: m.status === 'completed' && m.homeScore !== null && m.awayScore !== null
              ? `${m.homeScore > m.awayScore ? 'W' : 'L'} ${m.homeScore}-${m.awayScore}`
              : undefined,
          };
        });
      }
    }
  } catch (error) {
    console.error('Failed to load schedule from database', error);
  }

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Schedule`}
        description="View all scheduled matches for the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Week Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
                ← Previous Week
              </button>
              <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
                Next Week →
              </button>
            </div>
            <div className="text-white">Week 7</div>
          </div>

          {/* Division Filter */}
          <div className="mb-6 flex gap-2">
            <button className="px-4 py-2 bg-rose-300 text-gray-900 rounded font-semibold">
              Varsity
            </button>
            <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
              JV
            </button>
          </div>

          {/* Schedule List */}
          <div className="space-y-4">
            {schedule.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm bg-gray-800 rounded-lg">
                No scheduled match fixtures for this season yet.
              </div>
            ) : (
              schedule.map((match, index) => (
                <div
                  key={index}
                  className="bg-gray-800 rounded-lg p-6 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="text-sm text-gray-400 mb-2">
                      {match.date} • {match.time} • {match.division}
                    </div>
                    <div className="text-xl font-semibold text-white">
                      {match.team1} vs. {match.team2}
                    </div>
                  </div>
                  <div className="text-right">
                    {match.status === 'Completed' ? (
                      <div className="text-rose-300 font-bold">{match.result}</div>
                    ) : match.status === 'Live' ? (
                      <div className="text-emerald-400 font-bold animate-pulse">Live</div>
                    ) : (
                      <div className="text-gray-400">Upcoming</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}
