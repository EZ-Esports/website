import type { Metadata } from 'next';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import { getArchiveIndex } from '@/app/lib/db/queries';
import MigrationNotice from '@/app/components/ui/MigrationNotice';
import ArchiveCommandDeck, { type ArchiveGameGroup } from '@/app/components/sections/ArchiveCommandDeck';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';

export const metadata: Metadata = {
  title: 'Archives | EZ Esports',
  description: 'Explore past EZ Esports match results, standings, and seasonal records from previous league seasons.',
};

export default async function ArchivesPage() {
  // No try/catch here: a failed query should surface as a real error, not
  // silently collapse into an empty archive. The marketing route's error
  // boundary (`app/(marketing)/error.tsx`) handles it instead.
  const seasons = await getArchiveIndex();

  // Group seasons under their game, newest first (getArchiveIndex pre-sorts).
  const byGame = new Map<string, typeof seasons>();
  for (const season of seasons) {
    const entry = byGame.get(season.gameSlug) ?? [];
    entry.push(season);
    byGame.set(season.gameSlug, entry);
  }

  // Present games in the league's canonical order, including games with no archived seasons yet.
  const games: ArchiveGameGroup[] = GAME_SLUGS.map((slug) => {
    const gameSeasons = byGame.get(slug) ?? [];
    const gameConfig = GAMES[slug];
    return {
      slug,
      displayName: gameConfig.displayName,
      accent: gameConfig.accent,
      seasons: gameSeasons,
    };
  });

  return (
    <main className="min-h-[60vh]">
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="League History"
          title="Archives"
          lead="Every season at a glance: matches played, champion schools, and a shape of the league's history across every game."
        />
        {/* A failed fetch now throws and hits the route's error boundary, so
            an empty archive here is a real "nothing archived yet", the only
            case left where this notice is warranted. */}
        {seasons.length === 0 && <MigrationNotice />}

        {seasons.length === 0 ? (
          <Card className="max-w-2xl mx-auto text-center py-12">
            <p className="text-foreground-secondary text-base sm:text-lg font-medium">
              Seasonal archives are currently being processed. Check back soon!
            </p>
          </Card>
        ) : (
          <ArchiveCommandDeck games={games} />
        )}
      </Section>
    </main>
  );
}
