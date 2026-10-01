import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { getGameTeamsPageData } from '@/app/lib/db/queries';
import MigrationNotice from '@/app/components/ui/MigrationNotice';
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
  const schoolGroups = await getGameTeamsPageData(game);

  if (schoolGroups === null) {
    notFound();
  }

  const isTournament = gameConfig.competitionModel === 'tournament';
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
        {/* A failed fetch now throws and hits the route's error boundary, so
            an empty school list here is a real "nothing published yet", the
            only case left where this notice is warranted. */}
        {schoolGroups.length === 0 && <MigrationNotice />}

        <TeamsFilterClient
          schoolGroups={schoolGroups}
          gameDisplayName={gameConfig.displayName}
          gameSlug={game}
        />
      </Section>
    </main>
  );
}
