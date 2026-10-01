import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { getGameTournaments, getTournamentMatches } from '@/app/lib/db/queries';
import { buildTournamentStructure } from '@/app/lib/bracket';
import TournamentBracketView from '@/app/components/tournament/TournamentBracketView';
import SeasonSelect from '@/app/components/ui/SeasonSelect';
import MigrationNotice from '@/app/components/ui/MigrationNotice';

interface BracketPageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ season?: string; tournament?: string }>;
}

export async function generateMetadata({ params }: BracketPageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} Tournament Bracket | EZ Esports`,
    description: `Official tournament bracket, match results, and stage progression for ${gameConfig.displayName}.`,
  };
}

export default async function BracketPage({ params, searchParams }: BracketPageProps) {
  const { game } = await params;
  const { season: seasonParam, tournament: tournamentParam } = await searchParams;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  // Tournament bracket route is only for tournament-based games
  if (gameConfig.competitionModel !== 'tournament') {
    notFound();
  }

  const tournaments = await getGameTournaments(game);

  // Resolve selected tournament by slug (defaults to latest tournament if unspecified)
  const targetSlug = tournamentParam || seasonParam;
  const selectedTournament = targetSlug
    ? tournaments.find((t) => t.slug === targetSlug) || tournaments[tournaments.length - 1]
    : tournaments[tournaments.length - 1];

  const matches = selectedTournament ? await getTournamentMatches(selectedTournament.id) : [];
  const structure = buildTournamentStructure(matches);

  return (
    <main>
      <Section className="pt-20 md:pt-24">
        <SectionHeader
          as="h1"
          title={`${gameConfig.displayName} Tournament Bracket`}
          lead={
            selectedTournament
              ? `Official tournament bracket and stage results for the ${selectedTournament.name}`
              : `Official tournament bracket for ${gameConfig.displayName}`
          }
        />
        <p className="text-xs text-foreground-muted -mt-8 mb-8 text-center font-medium">
          All match times are Eastern Time (ET).
        </p>

        {(!selectedTournament || matches.length === 0) && <MigrationNotice />}

        {/* Filters: tournament / season picker */}
        {tournaments.length > 1 && selectedTournament && (
          <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <SeasonSelect
              basePath={`/${game}/bracket`}
              seasons={tournaments.map((t) => ({ name: t.slug, isActive: t.status === 'completed' }))}
              selected={selectedTournament.slug}
            />
          </div>
        )}

        {!selectedTournament ? (
          <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
            No tournaments found for {gameConfig.displayName} yet.
          </div>
        ) : (
          <TournamentBracketView structure={structure} />
        )}
      </Section>
    </main>
  );
}
