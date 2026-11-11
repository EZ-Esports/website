import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { getGameTeamsPageData, getGameHubData } from '@/app/lib/db/queries';
import TeamsFilterClient from './TeamsFilterClient';

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
  const isTournament = gameConfig.competitionModel === 'tournament';

  const [schoolGroups, varsityHub, jvHub] = await Promise.all([
    getGameTeamsPageData(game),
    getGameHubData(game, 'Varsity'),
    getGameHubData(game, 'JV'),
  ]);

  if (schoolGroups === null) {
    notFound();
  }

  const vTeams = new Set(varsityHub.topTeams.map((t) => t.team.toLowerCase()));
  const jvTeams = new Set(jvHub.topTeams.map((t) => t.team.toLowerCase()));
  const hasActiveSeason = Boolean(varsityHub.seasonName && (vTeams.size > 0 || jvTeams.size > 0));

  // Align displayed teams and division badges with the current competition season overview
  let displayedSchools = schoolGroups;
  if (hasActiveSeason) {
    displayedSchools = schoolGroups
      .filter((school) => {
        const key = school.schoolName.toLowerCase();
        return vTeams.has(key) || jvTeams.has(key);
      })
      .map((school) => {
        const key = school.schoolName.toLowerCase();
        const badges: string[] = [];
        if (isTournament) {
          badges.push('Open');
        } else {
          if (vTeams.has(key)) badges.push('Varsity');
          if (jvTeams.has(key)) badges.push('Junior Varsity');
        }
        return {
          ...school,
          divisionBadges: badges.length > 0 ? badges : ['Registered'],
        };
      });
  }

  const pageTitle = isTournament
    ? `${gameConfig.displayName} Participants & Rosters`
    : `${gameConfig.displayName} School Teams & Rosters`;
  const pageLead = isTournament
    ? "Explore member schools, season player rosters, and participant profiles"
    : "Explore member schools, season team snapshots, division squads, and player rosters";

  return (
    <main>
      <Section className="pt-20 md:pt-24">
        <SectionHeader
          as="h1"
          title={pageTitle}
          lead={pageLead}
        />

        <TeamsFilterClient
          schoolGroups={displayedSchools}
          gameDisplayName={gameConfig.displayName}
          gameSlug={game}
        />
      </Section>
    </main>
  );
}
