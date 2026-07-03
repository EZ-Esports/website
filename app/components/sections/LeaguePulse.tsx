import Link from 'next/link';
import ContentSection from '@/app/components/sections/ContentSection';
import { getCachedRecentResults } from '@/app/lib/db/queries';

/**
 * Homepage entry point into league data: the latest recorded results across
 * all games, with jump-offs to schedules, standings, and the archive.
 * Renders nothing if no results exist yet (fresh database).
 */
export default async function LeaguePulse() {
  let results: Awaited<ReturnType<typeof getCachedRecentResults>> = [];
  try {
    results = await getCachedRecentResults();
  } catch (error) {
    console.error('Failed to load recent results', error);
  }

  if (results.length === 0) return null;

  const games = Array.from(
    new Map(results.map((match) => [
      match.gameSlug,
      { slug: match.gameSlug, label: match.gameShortName },
    ])).values()
  );

  return (
    <ContentSection eyebrow="League Pulse" heading="Latest Results" description="" theme="dark">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {results.map((match) => (
            <Link
              key={match.id}
              href={`/${match.gameSlug}/schedule?season=${encodeURIComponent(match.seasonName)}&division=${encodeURIComponent(match.division)}`}
              className="bg-slate-900/30 border border-slate-800/80 border-l-4 border-l-ez-pink rounded-xl p-5 hover:border-slate-700/80 hover:bg-slate-900/40 transition-all duration-300 group block"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-ez-pink bg-ez-pink/10 border border-ez-pink/20 rounded-md px-2 py-0.5">
                  {match.gameShortName} · {match.division}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                    timeZone: 'America/New_York',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="text-sm font-bold text-white group-hover:text-ez-pink transition-colors leading-snug">
                {match.homeTeam}
                <span className="text-slate-500 font-medium px-1.5">vs</span>
                {match.awayTeam}
              </div>
              <div className="mt-2 text-lg font-black text-slate-200">
                {match.homeScore} - {match.awayScore}
                {match.status === 'forfeit' && (
                  <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-amber-400">Forfeit</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-bold">
          {games.map((game) => (
            <Link key={`${game.slug}-schedule`} href={`/${game.slug}/schedule`} className="text-slate-300 hover:text-ez-pink transition-colors">
              {game.label} Schedule →
            </Link>
          ))}
          {games.map((game) => (
            <Link key={`${game.slug}-standings`} href={`/${game.slug}/standings`} className="text-slate-300 hover:text-ez-pink transition-colors">
              {game.label} Standings →
            </Link>
          ))}
          <Link href="/archives" className="text-slate-300 hover:text-ez-pink transition-colors">
            Season Archives →
          </Link>
        </div>
      </div>
    </ContentSection>
  );
}
