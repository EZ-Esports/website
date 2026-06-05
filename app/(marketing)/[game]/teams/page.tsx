import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

interface TeamsPageProps {
  params: Promise<{ game: string }>;
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface RosterInfo {
    name: string;
    division: string;
    record: string;
  }

  interface TeamItem {
    id: string;
    name: string;
    rosters: RosterInfo[];
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

      const teamIds = teamRows.map((t) => t.id);

      if (teamIds.length > 0) {
        const rosterRows = await db
          .select()
          .from(schema.rosters)
          .where(inArray(schema.rosters.teamId, teamIds));

        // Group rosters by team
        const rostersByTeam = new Map<string, RosterInfo[]>();
        rosterRows.forEach((r) => {
          const arr = rostersByTeam.get(r.teamId) || [];
          arr.push({
            name: r.name,
            division: r.division,
            record: `${r.wins}-${r.losses}`,
          });
          rostersByTeam.set(r.teamId, arr);
        });

        teams = teamRows.map((t) => ({
          id: t.id,
          name: t.name,
          rosters: rostersByTeam.get(t.id) || [],
        })).filter(t => t.rosters.length > 0);
      }
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
          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teams.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm bg-gray-800 rounded-lg col-span-full">
                No teams registered for this game yet.
              </div>
            ) : (
              teams.map((team) => (
                <Card key={team.id} className="text-white hover:scale-[1.03] transition-all duration-300 flex flex-col justify-between">
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="w-20 h-20 mx-auto bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-white">
                        <span className="text-2xl font-extrabold">{team.name.charAt(0)}</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-4 tracking-tight">{team.name}</h3>
                    
                    <div className="space-y-2.5 text-left">
                      {team.rosters.map((roster, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-850 text-xs font-semibold text-slate-350">
                          <span>{roster.name} Squad</span>
                          <span className="text-ez-pink font-extrabold bg-ez-pink/5 px-2 py-0.5 rounded border border-ez-pink/15">{roster.record}</span>
                        </div>
                      ))}
                    </div>
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
