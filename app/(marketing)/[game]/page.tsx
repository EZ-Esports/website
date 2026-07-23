import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS, getGameSubRoute } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import Badge, { resultVariant } from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { Table, Th, Td, Tr } from '@/app/components/ui/Table';
import { getGameHubData } from '@/app/lib/db/queries';
import MigrationNotice from '@/app/components/ui/MigrationNotice';


const HUB_DESCRIPTIONS: Record<GameSlug, string> = {
  valorant:
    'Follow the EZ Esports Valorant league — standings, schedules, match results, and school rosters for NYC high-school Valorant competition.',
  'league-of-legends':
    'Follow the EZ Esports League of Legends division — standings, schedules, match results, and school rosters for NYC high-school League of Legends competition.',
  'team-fight-tactics':
    'Follow the EZ Esports Teamfight Tactics league — standings, schedules, match results, and school rosters for NYC high-school Teamfight Tactics competition.',
};

const RANK_MEDALS: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

interface GameHubPageProps {
  params: Promise<{ game: string }>;
}

export async function generateMetadata({ params }: GameHubPageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} | EZ Esports`,
    description: HUB_DESCRIPTIONS[game as GameSlug],
  };
}

// Bad slugs are already 404'd by app/(marketing)/[game]/layout.tsx.
export default async function GameHubPage({ params }: GameHubPageProps) {
  const { game } = await params;
  const gameConfig = GAMES[game as GameSlug];
  const slug = game as GameSlug;

  const { record, jvRecord, nextMatch, recentResults, topTeams } = await getGameHubData(slug);

  const seasonRecordParts: string[] = [];
  if (record !== null) seasonRecordParts.push('Varsity');
  if (jvRecord !== null) seasonRecordParts.push('JV');
  const seasonRecordCaption =
    topTeams.length > 0 && seasonRecordParts.length > 0
      ? seasonRecordParts.join(' · ')
      : undefined;

  return (
    <main>
      <Hero title={gameConfig.displayName} backgroundImage={gameConfig.imageUrl} size="medium" />

      {/* Standings preview */}
      <Section width="narrow">
        <MigrationNotice />
        <SectionHeader title="Standings" lead={seasonRecordCaption} />
        {topTeams.length === 0 ? (
          <p className="text-center py-8 text-foreground-secondary text-sm">
            Standings will populate once the season begins.
          </p>
        ) : (
          <div className="bg-surface-raised/60 border border-line rounded-2xl overflow-hidden shadow-2xl shadow-black/20 mb-10">
            <Table>
              <thead className="bg-surface-sunken/60 border-b border-line">
                <tr>
                  <Th>Rank</Th>
                  <Th>Team</Th>
                  <Th>Record</Th>
                  <Th>Win Percentage</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topTeams.map((entry) => (
                  <Tr key={entry.rank} interactive>
                    <Td className="font-bold">
                      {RANK_MEDALS[entry.rank] && (
                        <span aria-hidden="true">{RANK_MEDALS[entry.rank]} </span>
                      )}
                      {entry.rank}
                    </Td>
                    <Td className="font-bold text-foreground">{entry.team}</Td>
                    <Td className="font-medium">{entry.wins}-{entry.losses}</Td>
                    <Td className="font-bold text-foreground">{(entry.winPct * 100).toFixed(1)}%</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <Button href={getGameSubRoute(slug, 'standings')} variant="primary">View Full Standings</Button>
        </div>
      </Section>

      {/* Next match */}
      <Section tone="raised">
        <SectionHeader title="Schedule" />
        {nextMatch === null ? (
          <p className="text-center py-8 text-foreground-secondary text-sm">
            No upcoming matches scheduled.
          </p>
        ) : (
          <Card variant="tinted" interactive className="max-w-2xl mx-auto text-center">
            <Badge className="mb-4">Upcoming Match</Badge>
            <div className="text-xs text-foreground-secondary font-bold uppercase tracking-wider mb-2">
              {nextMatch.date}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mb-2 tracking-tight">
              {nextMatch.teams}
            </div>
            <div className="text-foreground-secondary text-sm font-medium">
              {nextMatch.division === 'JV' ? 'Junior Varsity' : nextMatch.division} Division
            </div>
          </Card>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <Button href={getGameSubRoute(slug, 'schedule')} variant="primary">View Full Schedule</Button>
        </div>
      </Section>

      {/* Recent results */}
      <Section width="narrow">
        <SectionHeader title="Recent Results" />
        {recentResults.length === 0 ? (
          <p className="text-center py-8 text-foreground-secondary text-sm">
            No completed matches yet. Check back after season play begins.
          </p>
        ) : (
          <div className="space-y-4">
            {recentResults.map((match, index) => (
              <Card key={index} accent padding="sm" className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-foreground-secondary font-medium mb-1">
                    {match.date} • {match.division === 'JV' ? 'Junior Varsity' : match.division} Division
                  </div>
                  <div className="text-foreground text-lg font-bold tracking-tight">{match.teams}</div>
                </div>
                <Badge variant={resultVariant(match.result.startsWith('W'))}>{match.result}</Badge>
              </Card>
            ))}
          </div>
        )}

        {/* Jump-offs into the rest of the game's pages */}
        <div className="flex flex-wrap justify-center gap-4 mt-10 pt-6 border-t border-line">
          <Button href={getGameSubRoute(slug, 'teams')} variant="outline">Teams &amp; Rosters</Button>
          <Button href="/archives" variant="outline">Season Archives</Button>
        </div>
      </Section>
    </main>
  );
}
