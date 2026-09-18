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
 *
 * This section is embedded in a composite page (`app/(marketing)/page.tsx`)
 * alongside several independent sections, none of which are wrapped in their
 * own boundary. An uncaught error here would bubble to the route's
 * `error.tsx` and blank the entire homepage over one section's DB hiccup.
 * So a failure is caught locally, same as the homepage's own content/gallery
 * fetches, but surfaced as a distinct notice rather than silently returning
 * `null` (which read identically to a genuinely empty database).
 */
export default async function LeaguePulse() {
  let results: Awaited<ReturnType<typeof getCachedRecentResults>>;
  try {
    results = await getCachedRecentResults();
  } catch (error) {
    console.error('Failed to load recent results for League Pulse', error);
    return (
      <Section>
        <SectionHeader eyebrow="League Pulse" title="Latest Results" />
        <Card
          variant="tinted"
          padding="sm"
          className="flex flex-col sm:flex-row sm:items-center gap-3 bg-warning/5 border-warning/20"
        >
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="warning" size="sm" className="font-black">
              Unable to Load
            </Badge>
          </div>
          <p className="text-xs text-foreground-secondary font-semibold leading-relaxed">
            We couldn&rsquo;t load the latest results right now. Refresh the page to try again.
          </p>
        </Card>
      </Section>
    );
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
            className="block h-full"
          >
            <Card accent interactive className="group h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Badge size="sm" className="shrink-0">
                    {match.gameShortName === 'VAL'
                      ? 'Valorant'
                      : match.gameShortName === 'LoL'
                      ? 'League of Legends'
                      : match.gameShortName === 'TFT'
                      ? 'Teamfight Tactics'
                      : match.gameShortName} · {match.division === 'JV' ? 'Junior Varsity' : match.division}
                  </Badge>
                  <span className="text-xs font-bold text-foreground-muted shrink-0">
                    {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div
                  className="text-sm font-bold text-foreground group-hover:text-accent transition-colors leading-snug line-clamp-2"
                  title={`${match.homeTeam} vs ${match.awayTeam}`}
                >
                  {match.homeTeam}
                  <span className="text-foreground-muted font-medium px-1.5">vs</span>
                  {match.awayTeam}
                </div>
              </div>
              <div className="mt-3 text-lg font-black text-foreground-secondary flex items-center gap-2">
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
