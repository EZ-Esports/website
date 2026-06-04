import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

interface RosterPageProps {
  params: Promise<{ game: string }>;
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface PlayerRosterItem {
    name: string;
    team: string;
    role: string;
    stats: string;
  }

  let players: PlayerRosterItem[] = [];
  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, game))
      .limit(1);

    if (gameRow[0]) {
      const teamsList = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.gameId, gameRow[0].id));

      const teamMap = new Map(teamsList.map((t) => [t.id, t]));
      const teamIds = teamsList.map((t) => t.id);

      const playersRows = teamIds.length > 0
        ? await db.select().from(schema.rosters).where(inArray(schema.rosters.teamId, teamIds))
        : [];

      players = playersRows.map((p) => {
        const team = teamMap.get(p.teamId);
        return {
          name: p.name,
          team: team ? `${team.name} (${team.division})` : 'Unknown',
          role: p.role,
          stats: p.bio || 'Active Player',
        };
      });
    }
  } catch (error) {
    console.error('Failed to load rosters from database', error);
  }

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Roster`}
        description="All players registered for the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Roster Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {players.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm">
                No active players registered for this game yet.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Bio / Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {players.map((player, index) => (
                    <tr key={index} className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{player.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{player.team}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${
                          player.role === 'Captain' 
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
                            : 'bg-gray-800 text-gray-300 border-gray-700'
                        }`}>
                          {player.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{player.stats}</td>
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
