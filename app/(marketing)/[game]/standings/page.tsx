import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';

interface StandingsPageProps {
  params: Promise<{ game: string }>;
}

export default async function StandingsPage({ params }: StandingsPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  // Placeholder standings data
  const standings = [
    { rank: 1, team: 'Stuyvesant', wins: 12, losses: 3, winPct: 0.800, gamesPlayed: 15 },
    { rank: 2, team: 'Bronx Science', wins: 11, losses: 4, winPct: 0.733, gamesPlayed: 15 },
    { rank: 3, team: 'Brooklyn Tech', wins: 10, losses: 5, winPct: 0.667, gamesPlayed: 15 },
    { rank: 4, team: 'Midwood', wins: 9, losses: 6, winPct: 0.600, gamesPlayed: 15 },
    { rank: 5, team: 'Staten Island Tech', wins: 8, losses: 7, winPct: 0.533, gamesPlayed: 15 },
    { rank: 6, team: 'Queens Tech', wins: 6, losses: 9, winPct: 0.400, gamesPlayed: 15 },
    { rank: 7, team: 'Manhattan Center', wins: 5, losses: 10, winPct: 0.333, gamesPlayed: 15 },
    { rank: 8, team: 'Brooklyn Latin', wins: 4, losses: 11, winPct: 0.267, gamesPlayed: 15 },
  ];

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
          </div>
        </div>
      </ContentSection>
    </main>
  );
}

