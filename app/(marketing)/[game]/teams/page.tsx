import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import MigrationNotice from '@/app/components/ui/MigrationNotice';
import TeamsFilterClient, { SchoolGroup, PlayerItem, RosterItem } from './TeamsFilterClient';

interface TeamsPageProps {
  params: Promise<{ game: string }>;
}

export async function generateMetadata({ params }: TeamsPageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} School Teams & Rosters | EZ Esports`,
    description: `Browse member schools, season team snapshots, division rosters, and player profiles for EZ Esports ${gameConfig.displayName}.`,
  };
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { game } = await params;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  let schoolGroups: SchoolGroup[] = [];
  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, game))
      .limit(1);

    if (gameRow[0]) {
      const teamsList = await db
        .select({
          teamId: schema.teams.id,
          schoolId: schema.teams.schoolId,
          gameId: schema.teams.gameId,
          seasonId: schema.teams.seasonId,
          schoolName: schema.schools.name,
          schoolSlug: schema.schools.slug,
          logoUrl: schema.schools.logoUrl,
          websiteUrl: schema.schools.websiteUrl,
          seasonName: schema.seasons.name,
          isSeasonActive: schema.seasons.isActive,
        })
        .from(schema.teams)
        .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
        .innerJoin(schema.seasons, eq(schema.teams.seasonId, schema.seasons.id))
        .where(and(eq(schema.teams.gameId, gameRow[0].id), isNull(schema.schools.deletedAt)))
        .orderBy(schema.schools.name, desc(schema.seasons.name));

      const teamIds = teamsList.map((t) => t.teamId);

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

        // Fetch real standings for record display
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
            isCaptain: p.isCaptain || p.role.toLowerCase() === 'captain',
          });
          playersByRoster.set(p.rosterId, arr);
        });

        // Group rosters by teamId
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

        // Group team snapshots by schoolId
        const schoolsMap = new Map<string, SchoolGroup>();

        teamsList.forEach((t) => {
          let school = schoolsMap.get(t.schoolId);
          if (!school) {
            school = {
              schoolId: t.schoolId,
              schoolName: t.schoolName,
              schoolSlug: t.schoolSlug,
              logoUrl: t.logoUrl,
              websiteUrl: t.websiteUrl,
              seasons: [],
            };
            schoolsMap.set(t.schoolId, school);
          }

          const rosters = rostersByTeam.get(t.teamId) || [];
          school.seasons.push({
            seasonId: t.seasonId,
            seasonName: t.seasonName,
            isSeasonActive: t.isSeasonActive,
            rosters,
          });
        });

        schoolGroups = Array.from(schoolsMap.values()).filter(
          (s) => s.seasons.some((season) => season.rosters.length > 0)
        );
      }
    }
  } catch (error) {
    console.error('Failed to load school teams and rosters from database', error);
  }

  return (
    <main>
      <Section>
        <SectionHeader
          as="h1"
          title={`${gameConfig.displayName} School Teams & Rosters`}
          lead="Explore member schools, season team snapshots, division squads, and player rosters"
        />
        <MigrationNotice />

        <TeamsFilterClient schoolGroups={schoolGroups} gameDisplayName={gameConfig.displayName} />
      </Section>
    </main>
  );
}
