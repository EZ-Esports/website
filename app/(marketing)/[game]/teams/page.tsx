import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

interface TeamsPageProps {
  params: Promise<{ game: string }>;
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface TeamItem {
    id: string;
    name: string;
    record: string;
    division: string;
  }

  let teams: TeamItem[] = [];
  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, game))
      .limit(1);

    if (gameRow[0]) {
      const teamRows = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.gameId, gameRow[0].id))
        .orderBy(schema.teams.name);

      teams = teamRows.map((t) => ({
        id: t.id,
        name: t.name,
        record: `${t.wins}-${t.losses}`,
        division: t.division,
      }));
    }
  } catch (error) {
    console.error('Failed to load teams from database', error);
  }

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Teams`}
        description="All teams competing in the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Division Filter */}
          <div className="mb-6 flex gap-2">
            <button className="px-4 py-2 bg-rose-300 text-gray-900 rounded font-semibold">
              Varsity
            </button>
            <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
              JV
            </button>
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teams.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm bg-gray-800 rounded-lg col-span-full">
                No teams registered for this game yet.
              </div>
            ) : (
              teams.map((team) => (
                <Card key={team.id} className="bg-gray-800 text-white">
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="w-20 h-20 mx-auto bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold">{team.name.charAt(0)}</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{team.name}</h3>
                    <div className="text-gray-400 text-sm mb-1">{team.division}</div>
                    <div className="text-rose-300 font-bold">{team.record}</div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}
