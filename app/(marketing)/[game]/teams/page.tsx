import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import Card from '@/app/components/ui/Card';

interface TeamsPageProps {
  params: Promise<{ game: string }>;
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  interface PlayerItem {
    name: string;
    role: string;
    bio: string;
  }

  interface RosterItem {
    name: string;
    division: string;
    record: string;
    players: PlayerItem[];
  }

  interface TeamRosterGroup {
    teamName: string;
    rosters: RosterItem[];
  }

  let teamGroups: TeamRosterGroup[] = [];
  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, game))
      .limit(1);

    if (gameRow[0]) {
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
        .where(eq(schema.teams.gameId, gameRow[0].id))
        .orderBy(schema.schools.name);

      const teamIds = teamsList.map((t) => t.id);

      if (teamIds.length > 0) {
        const rostersList = await db
          .select()
          .from(schema.rosters)
          .where(inArray(schema.rosters.teamId, teamIds));

        const rosterIds = rostersList.map((r) => r.id);
        const playersList = rosterIds.length > 0
          ? await db
              .select({
                id: schema.players.id,
                rosterId: schema.players.rosterId,
                memberId: schema.players.memberId,
                role: schema.players.role,
                ign: schema.players.ign,
                bio: schema.players.bio,
                isCaptain: schema.players.isCaptain,
                firstName: schema.members.firstName,
                lastName: schema.members.lastName,
              })
              .from(schema.players)
              .innerJoin(schema.members, eq(schema.players.memberId, schema.members.id))
              .where(inArray(schema.players.rosterId, rosterIds))
          : [];

        // Group players by roster
        const playersByRoster = new Map<string, PlayerItem[]>();
        playersList.forEach((p) => {
          const arr = playersByRoster.get(p.rosterId) || [];
          arr.push({
            name: p.ign ? `${p.firstName} "${p.ign}" ${p.lastName}` : `${p.firstName} ${p.lastName}`,
            role: p.role.charAt(0).toUpperCase() + p.role.slice(1),
            bio: p.bio || 'Active Player',
          });
          playersByRoster.set(p.rosterId, arr);
        });

        // Group rosters by team
        const rostersByTeam = new Map<string, RosterItem[]>();
        rostersList.forEach((r) => {
          const arr = rostersByTeam.get(r.teamId) || [];
          arr.push({
            name: r.name,
            division: r.division,
            record: `${(r as any).wins || 0}-${(r as any).losses || 0}`,
            players: playersByRoster.get(r.id) || [],
          });
          rostersByTeam.set(r.teamId, arr);
        });

        // Map to final nested groups
        teamGroups = teamsList.map((t) => ({
          teamName: t.name,
          rosters: rostersByTeam.get(t.id) || [],
        })).filter(g => g.rosters.length > 0);
      }
    }
  } catch (error) {
    console.error('Failed to load teams and rosters from database', error);
  }

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Teams & Rosters`}
        description="View school teams, division squads, and registered player rosters"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto space-y-12">
          {teamGroups.length === 0 ? (
            <div className="text-center p-12 text-slate-500 text-sm bg-slate-900/20 rounded-2xl border border-slate-800/60">
              No active teams or rosters registered for this game yet.
            </div>
          ) : (
            teamGroups.map((group, index) => (
              <div key={index} className="space-y-6 bg-slate-950/20 p-6 sm:p-8 rounded-2xl border border-slate-900">
                <div className="flex items-center gap-4 border-b border-slate-850 pb-4">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-white shrink-0">
                    <span className="text-lg font-black">{group.teamName.charAt(0)}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">{group.teamName}</h2>
                </div>

                <div className="space-y-8">
                  {group.rosters.map((roster, rIdx) => (
                    <div key={rIdx} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                          {roster.name} Division
                        </h3>
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-ez-pink/10 border border-ez-pink/25 text-ez-pink rounded-full">
                          Record: {roster.record}
                        </span>
                      </div>

                      {roster.players.length === 0 ? (
                        <p className="text-xs text-slate-500 italic pl-2">No players registered under this division roster.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roster.players.map((player, pIdx) => (
                            <Card key={pIdx} className="hover:border-slate-700/60 transition-all text-white p-5 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-bold text-base tracking-tight text-white">{player.name}</h4>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                                    player.role === 'Captain' 
                                      ? 'bg-ez-pink/15 text-ez-pink border-ez-pink/35' 
                                      : 'bg-slate-950/40 text-slate-400 border-slate-800/80'
                                  }`}>
                                    {player.role}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{player.bio}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ContentSection>
    </main>
  );
}
