import Link from 'next/link';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
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
    <Section>
      <SectionHeader eyebrow="League Pulse" title="Latest Results" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((match) => (
          <Link
            key={match.id}
            href={`/${match.gameSlug}/schedule?season=${encodeURIComponent(match.seasonName)}&division=${encodeURIComponent(match.division)}`}
            className="block"
          >
            <Card accent interactive className="group">
              <div className="flex items-center justify-between mb-3">
                <Badge size="sm">
                  {match.gameShortName === 'VAL'
                    ? 'Valorant'
                    : match.gameShortName === 'LoL'
                    ? 'League of Legends'
                    : match.gameShortName === 'TFT'
                    ? 'Teamfight Tactics'
                    : match.gameShortName} · {match.division === 'JV' ? 'Junior Varsity' : match.division}
                </Badge>
                <span className="text-xs font-bold text-foreground-muted">
                  {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                    timeZone: 'America/New_York',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="text-sm font-bold text-foreground group-hover:text-accent transition-colors leading-snug">
                {match.homeTeam}
                <span className="text-foreground-muted font-medium px-1.5">vs</span>
                {match.awayTeam}
              </div>
              <div className="mt-2 text-lg font-black text-foreground-secondary flex items-center gap-2">
                {match.homeScore} - {match.awayScore}
                {match.status === 'forfeit' && <Badge variant="warning" size="sm">Forfeit</Badge>}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-bold">
        {games.map((game) => (
          <Link key={`${game.slug}-schedule`} href={`/${game.slug}/schedule`} className="text-foreground-secondary hover:text-accent transition-colors">
            {game.label} Schedule →
          </Link>
        ))}
        {games.map((game) => (
          <Link key={`${game.slug}-standings`} href={`/${game.slug}/standings`} className="text-foreground-secondary hover:text-accent transition-colors">
            {game.label} Standings →
          </Link>
        ))}
        <Link href="/archives" className="text-foreground-secondary hover:text-accent transition-colors">
          Season Archives →
        </Link>
      </div>
    </Section>
  );
}
