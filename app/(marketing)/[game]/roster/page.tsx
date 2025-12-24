import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';

interface RosterPageProps {
  params: Promise<{ game: string }>;
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  // Placeholder roster data
  const players = [
    { name: 'Player One', team: 'Stuyvesant', role: 'Captain', stats: '2.5 K/D' },
    { name: 'Player Two', team: 'Stuyvesant', role: 'Player', stats: '2.1 K/D' },
    { name: 'Player Three', team: 'Bronx Science', role: 'Captain', stats: '2.3 K/D' },
    { name: 'Player Four', team: 'Bronx Science', role: 'Player', stats: '1.9 K/D' },
    { name: 'Player Five', team: 'Brooklyn Tech', role: 'Captain', stats: '2.0 K/D' },
    { name: 'Player Six', team: 'Brooklyn Tech', role: 'Player', stats: '1.8 K/D' },
    { name: 'Player Seven', team: 'Midwood', role: 'Captain', stats: '2.2 K/D' },
    { name: 'Player Eight', team: 'Midwood', role: 'Player', stats: '1.7 K/D' },
  ];

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Roster`}
        description="All players registered for the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Team Filter */}
          <div className="mb-6">
            <select className="px-4 py-2 bg-gray-800 text-white rounded border border-gray-700">
              <option value="all">All Teams</option>
              <option value="stuyvesant">Stuyvesant</option>
              <option value="bronx-science">Bronx Science</option>
              <option value="brooklyn-tech">Brooklyn Tech</option>
              <option value="midwood">Midwood</option>
            </select>
          </div>

          {/* Roster Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {players.map((player, index) => (
                  <tr key={index} className="hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{player.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{player.team}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{player.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{player.stats}</td>
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

