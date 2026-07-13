import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Badge from '@/app/components/ui/Badge';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

interface TeamsPageProps {
  params: Promise<{ game: string }>;
}

export async function generateMetadata({ params }: TeamsPageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} Teams & Rosters | EZ Esports`,
    description: `View school teams, division squads, and registered player rosters for EZ Esports ${gameConfig.displayName}.`,
  };
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
    id: string;
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
        .where(and(eq(schema.teams.gameId, gameRow[0].id), isNull(schema.schools.deletedAt)))
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

        // Fetch real standings for record display (DATA-001)
        const standingsRows = await db
          .select()
          .from(schema.rosterStandings)
          .where(inArray(schema.rosterStandings.teamId, teamIds))
          .orderBy(desc(schema.rosterStandings.wins));

        // Map standings by teamId + division key
        const standingsMap = new Map<string, { wins: number; losses: number }>();
        standingsRows.forEach((s) => {
          if (s.teamId) {
            standingsMap.set(`${s.teamId}-${s.division}`, {
              wins: s.wins || 0,
              losses: s.losses || 0,
            });
          }
        });

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
          const standingKey = `${r.teamId}-${r.division}`;
          const standing = standingsMap.get(standingKey);
          arr.push({
            id: r.id,
            name: r.name,
            division: r.division,
            record: standing ? `${standing.wins}-${standing.losses}` : '0-0',
            players: playersByRoster.get(r.id) || [],
          });
          rostersByTeam.set(r.teamId, arr);
        });

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
      <Section>
        <SectionHeader
          as="h1"
          title={`${gameConfig.displayName} Teams & Rosters`}
          lead="View school teams, division squads, and registered player rosters"
        />

        <div className="space-y-12">
          {teamGroups.length === 0 ? (
            <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 rounded-2xl border border-line">
              No active teams or rosters registered for this game yet.
            </div>
          ) : (
            teamGroups.map((group, index) => (
              <Card key={index} as="section" padding="lg" className="space-y-6">
                <div className="flex items-center gap-4 border-b border-line pb-4">
                  <div className="w-12 h-12 bg-surface-sunken border border-line rounded-full flex items-center justify-center text-foreground shrink-0">
                    <span className="text-lg font-black">{group.teamName.charAt(0)}</span>
                  </div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight">{group.teamName}</h2>
                </div>

                <div className="space-y-8">
                  {group.rosters.map((roster) => (
                    <div key={roster.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-secondary">
                          {roster.name} Division
                        </h3>
                        <Badge size="sm">Record: {roster.record}</Badge>
                      </div>

                      {roster.players.length === 0 ? (
                        <p className="text-xs text-foreground-muted italic pl-2">
                          No players registered under this division roster.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roster.players.map((player, pIdx) => (
                            <Card key={pIdx} interactive padding="sm" className="flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2 gap-2">
                                  <h4 className="font-bold text-base tracking-tight text-foreground">{player.name}</h4>
                                  <Badge
                                    size="sm"
                                    variant={player.role === 'Captain' ? 'accent' : 'neutral'}
                                  >
                                    {player.role}
                                  </Badge>
                                </div>
                                <p className="text-xs text-foreground-secondary leading-relaxed mt-1.5">{player.bio}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      </Section>
    </main>
  );
}
