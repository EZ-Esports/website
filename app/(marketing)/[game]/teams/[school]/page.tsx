import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { slugify } from '@/app/lib/text-utils';
import SchoolSnapshotsClient, { SchoolDetailData, PlayerItem, RosterItem, SeasonTeamSnapshot } from './SchoolSnapshotsClient';

interface SchoolPageProps {
  params: Promise<{ game: string; school: string }>;
}

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const { game, school } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];

  try {
    const schoolRows = await db
      .select({ name: schema.schools.name, slug: schema.schools.slug })
      .from(schema.schools)
      .where(isNull(schema.schools.deletedAt));

    const matchedSchool = schoolRows.find(
      (s) => s.slug === school || slugify(s.name) === school
    );

    const schoolName = matchedSchool ? matchedSchool.name : 'School';
    return {
      title: `${schoolName} - ${gameConfig.displayName} Teams & Rosters | EZ Esports`,
      description: `View ${schoolName} team snapshots, division rosters, and registered player profiles for EZ Esports ${gameConfig.displayName}.`,
    };
  } catch {
    return {
      title: `${gameConfig.displayName} School Teams & Rosters | EZ Esports`,
    };
  }
}

export default async function SchoolPage({ params }: SchoolPageProps) {
  const { game, school: schoolSlugParam } = await params;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  let schoolData: SchoolDetailData | null = null;

  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, game))
      .limit(1);

    if (gameRow[0]) {
      // Find matching school by slug or slugified name
      const allSchools = await db
        .select()
        .from(schema.schools)
        .where(isNull(schema.schools.deletedAt));

      const matchedSchoolRow = allSchools.find(
        (s) => s.slug === schoolSlugParam || slugify(s.name) === schoolSlugParam || s.id === schoolSlugParam
      );

      if (matchedSchoolRow) {
        // Query teams for this school and game across all seasons
        const teamsList = await db
          .select({
            teamId: schema.teams.id,
            schoolId: schema.teams.schoolId,
            gameId: schema.teams.gameId,
            seasonId: schema.teams.seasonId,
            seasonName: schema.seasons.name,
            isSeasonActive: schema.seasons.isActive,
          })
          .from(schema.teams)
          .innerJoin(schema.seasons, eq(schema.teams.seasonId, schema.seasons.id))
          .where(
            and(
              eq(schema.teams.schoolId, matchedSchoolRow.id),
              eq(schema.teams.gameId, gameRow[0].id)
            )
          )
          .orderBy(desc(schema.seasons.name));

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

          // Fetch standings for records
          const standingsRows = await db
            .select()
            .from(schema.rosterStandings)
            .where(inArray(schema.rosterStandings.teamId, teamIds));

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

          // Build season snapshots
          const seasonSnapshots: SeasonTeamSnapshot[] = teamsList.map((t) => ({
            seasonId: t.seasonId,
            seasonName: t.seasonName,
            isSeasonActive: t.isSeasonActive,
            rosters: rostersByTeam.get(t.teamId) || [],
          })).filter((s) => s.rosters.length > 0);

          schoolData = {
            schoolId: matchedSchoolRow.id,
            schoolName: matchedSchoolRow.name,
            schoolSlug: matchedSchoolRow.slug || slugify(matchedSchoolRow.name),
            logoUrl: matchedSchoolRow.logoUrl,
            websiteUrl: matchedSchoolRow.websiteUrl,
            seasons: seasonSnapshots,
          };
        }
      }
    }
  } catch (error) {
    console.error('Failed to load school team snapshots from database', error);
  }

  if (!schoolData) {
    notFound();
  }

  return (
    <main>
      <Section className="pt-20 md:pt-24">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/${game}/teams`}
            className="inline-flex items-center gap-2 text-xs font-bold text-accent hover:underline transition-colors group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>Back to All {gameConfig.displayName} Schools</span>
          </Link>
        </div>

        <SchoolSnapshotsClient school={schoolData} gameDisplayName={gameConfig.displayName} />
      </Section>
    </main>
  );
}
