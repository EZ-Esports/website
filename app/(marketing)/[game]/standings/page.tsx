import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

interface StandingsPageProps {
  params: Promise<{ game: string }>;
}

export default async function StandingsPage({ params }: StandingsPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface StandingsEntry {
    rank: number;
    team: string;
    wins: number;
    losses: number;
    winPct: number;
    gamesPlayed: number;
  }

  let standings: StandingsEntry[] = [];
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
        .orderBy(desc(schema.teams.wins), schema.teams.losses);

      standings = teamRows.map((t, index) => {
        const gamesPlayed = t.wins + t.losses;
        const winPct = gamesPlayed > 0 ? t.wins / gamesPlayed : 0;
        return {
          rank: index + 1,
          team: t.name,
          wins: t.wins,
          losses: t.losses,
          winPct,
          gamesPlayed,
        };
      });
    }
  } catch (error) {
    console.error('Failed to load standings from database', error);
  }

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Standings`}
        description="Current season standings for all teams"
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

          {/* Standings Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {standings.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm">
                No teams registered for this game yet.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">W-L</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Win %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Games</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {standings.map((entry) => (
                    <tr key={entry.rank} className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{entry.rank}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold">{entry.team}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{entry.wins}-{entry.losses}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(entry.winPct * 100).toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{entry.gamesPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}
