import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';
import Link from 'next/link';

interface StandingsPageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ division?: string }>;
}

export default async function StandingsPage({ params, searchParams }: StandingsPageProps) {
  const { game } = await params;
  const { division = 'Varsity' } = await searchParams;
  
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
        .select({
          id: schema.teams.id,
          schoolId: schema.teams.schoolId,
          gameId: schema.teams.gameId,
          seasonId: schema.teams.seasonId,
          name: schema.schools.name,
        })
        .from(schema.teams)
        .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
        .where(eq(schema.teams.gameId, gameRow[0].id));

      const teamIds = teamRows.map((t) => t.id);
      const teamMap = new Map(teamRows.map((t) => [t.id, t]));

      if (teamIds.length > 0) {
        const rosterRows = await db
          .select()
          .from(schema.rosterStandings)
          .where(
            and(
              inArray(schema.rosterStandings.teamId, teamIds),
              eq(schema.rosterStandings.division, division)
            )
          )
          .orderBy(desc(schema.rosterStandings.wins), schema.rosterStandings.losses);

        standings = rosterRows.map((r, index) => {
          const team = teamMap.get(r.teamId!);
          const wins = r.wins || 0;
          const losses = r.losses || 0;
          const gamesPlayed = wins + losses;
          const winPct = gamesPlayed > 0 ? wins / gamesPlayed : 0;
          return {
            rank: index + 1,
            team: team?.name || 'Unknown',
            wins,
            losses,
            winPct,
            gamesPlayed,
          };
        });
      }
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
            <Link
              href={`/${game}/standings?division=Varsity`}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                division === 'Varsity' 
                  ? 'bg-ez-pink text-ez-black hover:bg-ez-pink/80'
                  : 'bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              Varsity
            </Link>
            <Link
              href={`/${game}/standings?division=JV`}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                division === 'JV'
                  ? 'bg-ez-pink text-ez-black hover:bg-ez-pink/80' 
                  : 'bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              JV
            </Link>
          </div>

          {/* Standings Table */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {standings.length === 0 ? (
              <div className="text-center p-12 text-slate-500 text-sm">
                No teams registered for this game and division yet.
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
                          <span className="text-yellow-500 font-bold">🏆 1</span>
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
                      <td className="px-6 py-4 text-sm font-bold text-white">{(entry.winPct * 100).toFixed(1)}%</td>
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
