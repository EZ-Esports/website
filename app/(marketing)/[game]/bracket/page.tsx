import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { getSeasonMatches, getSeasonsWithGames } from '@/app/lib/db/queries';
import { resolveSelectedSeason } from '@/app/lib/db/match-page';
import { buildTournamentStructure } from '@/app/lib/bracket';
import TournamentBracketView from '@/app/components/tournament/TournamentBracketView';
import SeasonSelect from '@/app/components/ui/SeasonSelect';
import MigrationNotice from '@/app/components/ui/MigrationNotice';

interface BracketPageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ season?: string }>;
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
  const { season: seasonParam } = await searchParams;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  // Tournament bracket route is only for tournament-based games
  if (gameConfig.competitionModel !== 'tournament') {
    notFound();
  }

  const seasons = (await getSeasonsWithGames()).filter((s) => s.gameSlug === game);
  const selectedSeason = resolveSelectedSeason(seasons, seasonParam);

  let rawMatches: Awaited<ReturnType<typeof getSeasonMatches>> = [];
  if (selectedSeason) {
    // For tournament games, matches run undivided
    rawMatches = await getSeasonMatches(selectedSeason.id, 'All');
  }

  const structure = buildTournamentStructure(
    rawMatches.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt.toISOString(),
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      notes: m.notes,
    }))
  );

  return (
    <main>
      <Section className="pt-20 md:pt-24">
        <SectionHeader
          as="h1"
          title={`${gameConfig.displayName} Tournament Bracket`}
          lead={
            selectedSeason
              ? `Official tournament bracket and stage results for the ${selectedSeason.name} season`
              : `Official tournament bracket for ${gameConfig.displayName}`
          }
        />
        <p className="text-xs text-foreground-muted -mt-8 mb-8 text-center font-medium">
          All match times are Eastern Time (ET).
        </p>

        {(!selectedSeason || rawMatches.length === 0) && <MigrationNotice />}

        {/* Filters: season picker */}
        {seasons.length > 1 && selectedSeason && (
          <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <SeasonSelect
              basePath={`/${game}/bracket`}
              seasons={seasons.map((s) => ({ name: s.name, isActive: s.isActive }))}
              selected={selectedSeason.name}
            />
          </div>
        )}

        {!selectedSeason ? (
          <div className="text-center p-12 text-foreground-muted text-sm bg-surface-raised/40 border border-line rounded-2xl">
            No seasons found for {gameConfig.displayName} yet.
          </div>
        ) : (
          <TournamentBracketView structure={structure} />
        )}
      </Section>
    </main>
  );
}
