import type { Metadata } from 'next';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { getArchiveIndex } from '@/app/lib/db/queries';
import MigrationNotice from '@/app/components/ui/MigrationNotice';


export const metadata: Metadata = {
  title: 'Archives | EZ Esports',
  description: 'Explore past EZ Esports match results, standings, and seasonal records from previous league seasons.',
};

export default async function ArchivesPage() {
  let seasons: Awaited<ReturnType<typeof getArchiveIndex>> = [];
  try {
    seasons = await getArchiveIndex();
  } catch (error) {
    console.error('Failed to load archive index', error);
  }

  // Group seasons under their game, newest first (getArchiveIndex pre-sorts).
  const byGame = new Map<string, { gameName: string; seasons: typeof seasons }>();
  for (const season of seasons) {
    const entry = byGame.get(season.gameSlug) ?? { gameName: season.gameName, seasons: [] };
    entry.seasons.push(season);
    byGame.set(season.gameSlug, entry);
  }

  return (
    <main className="min-h-[60vh]">
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="League History"
          title="Archives"
          lead="Explore past matches, standings, and seasonal records"
        />
        <MigrationNotice />

        {seasons.length === 0 ? (
          <Card className="max-w-2xl mx-auto text-center py-12">
            <p className="text-foreground-secondary text-base sm:text-lg font-medium">
              Seasonal archives are currently being processed. Check back soon!
            </p>
          </Card>
        ) : (
          <div className="space-y-12">
            {[...byGame.entries()].map(([gameSlug, group]) => (
              <section key={gameSlug}>
                <h2 className="text-xl font-black text-foreground uppercase tracking-wider mb-5">
                  {group.gameName}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.seasons.map((season) => (
                    <Card key={season.id} interactive>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl font-black text-foreground tracking-tight">{season.name}</span>
                        {season.isActive && (
                          <Badge variant="success" size="sm">Current</Badge>
                        )}
                      </div>

                      <dl className="space-y-1.5 text-sm mb-5">
                        {season.champion && (
                          <div className="flex items-center gap-2">
                            <dt className="text-foreground-muted font-bold">
                              <span aria-hidden="true">🏆</span>
                              <span className="sr-only">Champion</span>
                            </dt>
                            <dd className="text-foreground font-bold">{season.champion}</dd>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <dt className="text-foreground-muted font-medium">Matches</dt>
                          <dd className="text-foreground-secondary font-bold">{season.matchCount}</dd>
                        </div>
                      </dl>

                      <div className="flex gap-3">
                        <Button
                          href={`/${season.gameSlug}/schedule?season=${encodeURIComponent(season.name)}`}
                          variant="outline"
                          size="sm"
                        >
                          Schedule
                        </Button>
                        <Button
                          href={`/${season.gameSlug}/standings?season=${encodeURIComponent(season.name)}`}
                          variant="outline"
                          size="sm"
                        >
                          Standings
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
