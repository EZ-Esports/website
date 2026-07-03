import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import { getArchiveIndex } from '@/app/lib/db/queries';

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
    <main className="container mx-auto px-4 py-20 min-h-[60vh]">
      <div className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight uppercase">Archives</h1>
        <div className="w-12 h-0.5 bg-slate-700 mx-auto rounded-full mb-4" />
        <p className="text-slate-400 font-medium">
          Explore past matches, standings, and seasonal records
        </p>
      </div>

      {seasons.length === 0 ? (
        <Card className="max-w-2xl mx-auto text-center py-12">
          <p className="text-slate-300 text-base sm:text-lg font-medium">
            Seasonal archives are currently being processed. Check back soon!
          </p>
        </Card>
      ) : (
        <div className="max-w-6xl mx-auto space-y-12">
          {[...byGame.entries()].map(([gameSlug, group]) => (
            <section key={gameSlug}>
              <h2 className="text-xl font-black text-white uppercase tracking-wider mb-5">
                {group.gameName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.seasons.map((season) => (
                  <Card key={season.id} className="hover:scale-[1.01] duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-black text-white tracking-tight">{season.name}</span>
                      {season.isActive && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5">
                          Current
                        </span>
                      )}
                    </div>

                    <dl className="space-y-1.5 text-sm mb-5">
                      {season.champion && (
                        <div className="flex items-center gap-2">
                          <dt className="text-slate-500 font-bold">
                            <span aria-hidden="true">🏆</span>
                            <span className="sr-only">Champion</span>
                          </dt>
                          <dd className="text-slate-200 font-bold">{season.champion}</dd>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <dt className="text-slate-500 font-medium">Matches</dt>
                        <dd className="text-slate-300 font-bold">{season.matchCount}</dd>
                      </div>
                    </dl>

                    <div className="flex gap-3 text-xs font-bold">
                      <Link
                        href={`/${season.gameSlug}/schedule?season=${encodeURIComponent(season.name)}`}
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                      >
                        Schedule
                      </Link>
                      <Link
                        href={`/${season.gameSlug}/standings?season=${encodeURIComponent(season.name)}`}
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                      >
                        Standings
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
