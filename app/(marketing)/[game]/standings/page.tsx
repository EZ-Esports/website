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
          <div className="mb-8 flex gap-2">
            <button className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-ez-pink to-ez-purple text-white rounded-lg shadow-md shadow-ez-pink/10 cursor-pointer">
              Varsity
            </button>
            <button className="px-5 py-2 text-sm font-bold bg-slate-900 border border-slate-800/80 text-slate-400 rounded-lg hover:text-white hover:border-slate-700 transition-all cursor-pointer">
              JV
            </button>
          </div>

          {/* Standings Table */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {standings.length === 0 ? (
              <div className="text-center p-12 text-slate-500 text-sm">
                No teams registered for this game yet.
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-[#0b101d] border-b border-slate-800/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Team</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">W-L</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Win %</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Games</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {standings.map((entry) => (
                    <tr key={entry.rank} className="hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-300">
                        {entry.rank === 1 ? (
                          <span className="text-yellow-500 text-glow">🏆 1</span>
                        ) : entry.rank === 2 ? (
                          <span className="text-slate-400">🥈 2</span>
                        ) : entry.rank === 3 ? (
                          <span className="text-amber-600">🥉 3</span>
                        ) : (
                          entry.rank
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-white">{entry.team}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-400">{entry.wins}-{entry.losses}</td>
                      <td className="px-6 py-4 text-sm font-bold text-ez-pink">{(entry.winPct * 100).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-400">{entry.gamesPlayed}</td>
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
