import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import FilterTabs from '@/app/components/ui/FilterTabs';
import { Table, Th, Td, Tr } from '@/app/components/ui/Table';
import { getSeasonDivisions, getSeasonStandingsFor, getSeasonsWithGames } from '@/app/lib/db/queries';
import { pointsFromNotes, resolveSelectedSeason, type StandingRow } from '@/app/lib/db/match-page';
import SeasonSelect from '@/app/components/ui/SeasonSelect';

interface StandingsPageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ division?: string; season?: string }>;
}

export async function generateMetadata({ params }: StandingsPageProps): Promise<Metadata> {
  const { game } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];
  return {
    title: `${gameConfig.displayName} Standings | EZ Esports`,
    description: `Season standings for the EZ Esports ${gameConfig.displayName} league.`,
  };
}

const MEDALS: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

function RankCell({ rank }: { rank: number | null }) {
  const medal = rank !== null ? MEDALS[rank] : undefined;
  if (!medal) return <>{rank ?? '—'}</>;
  return (
    <span className="font-bold">
      <span aria-hidden="true">{medal} </span>
      <span>{rank}</span>
    </span>
  );
}

function TeamStandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <Table>
      <thead className="bg-surface-sunken/60 border-b border-line">
        <tr>
          <Th>Rank</Th>
          <Th>Team</Th>
          <Th>W-L</Th>
          <Th>Win %</Th>
          <Th>Games</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((entry) => (
          <Tr key={`${entry.rank}-${entry.schoolName}`} interactive>
            <Td className="font-bold">
              <RankCell rank={entry.rank} />
            </Td>
            <Td className="font-bold text-foreground">{entry.schoolName}</Td>
            <Td className="font-medium">
              {entry.wins ?? 0}-{entry.losses ?? 0}
            </Td>
            <Td className="font-bold text-foreground">
              {entry.winPct !== null ? `${(entry.winPct * 100).toFixed(1)}%` : '—'}
            </Td>
            <Td className="font-medium">{entry.gamesPlayed ?? '—'}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Individual (per-player) standings, e.g. TFT point leaderboards. */
function PlayerStandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <Table>
      <thead className="bg-surface-sunken/60 border-b border-line">
        <tr>
          <Th>Rank</Th>
          <Th>Player</Th>
          <Th>School</Th>
          <Th>Points</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((entry) => (
          <Tr key={`${entry.rank}-${entry.playerName}`} interactive>
            <Td className="font-bold">
              <RankCell rank={entry.rank} />
            </Td>
            <Td className="font-bold text-foreground">
              {entry.playerName}
              {entry.playerIgn && (
                <span className="text-foreground-muted font-medium ml-2">{entry.playerIgn}</span>
              )}
            </Td>
            <Td className="font-medium">{entry.schoolName}</Td>
            <Td className="font-bold text-foreground">
              {entry.points ?? pointsFromNotes(entry.notes) ?? '—'}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function StandingsPage({ params, searchParams }: StandingsPageProps) {
  const { game } = await params;
  const { division: divisionParam, season: seasonParam } = await searchParams;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  let seasons: Awaited<ReturnType<typeof getSeasonsWithGames>> = [];
  let divisions: string[] = ['Varsity', 'JV'];
  let standings: StandingRow[] = [];
  let source: 'snapshot' | 'computed' = 'computed';
  let division = divisionParam ?? 'Varsity';

  try {
    seasons = (await getSeasonsWithGames()).filter((s) => s.gameSlug === game);
  } catch (error) {
    console.error('Failed to load seasons from database', error);
  }

  const selectedSeason = resolveSelectedSeason(seasons, seasonParam);

  try {
    if (selectedSeason) {
      // Optimistically fetch the requested division alongside the division
      // list; refetch only in the rare case the requested one doesn't exist.
      const [divisionList, result] = await Promise.all([
        getSeasonDivisions(selectedSeason.id),
        getSeasonStandingsFor(selectedSeason.id, division),
      ]);
      divisions = divisionList;
      let effective = result;
      if (!divisions.includes(division)) {
        division = divisions[0];
        effective = await getSeasonStandingsFor(selectedSeason.id, division);
      }
      standings = effective.rows;
      source = effective.source;
    }
  } catch (error) {
    console.error('Failed to load standings from database', error);
  }

  const isIndividual = standings.some((row) => row.playerName !== null);
  const isArchived = Boolean(selectedSeason && !selectedSeason.isActive);

  return (
    <main>
      <Section>
        <SectionHeader
          as="h1"
          title={`${gameConfig.displayName} Standings`}
          lead={
            isArchived
              ? `Final standings from the ${selectedSeason?.name} season`
              : 'Current season standings for all teams'
          }
        />

        {/* Filters: division tabs + season picker */}
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <FilterTabs
            tabs={divisions.map((d) => ({
              label: d === 'All' ? 'Players' : d,
              value: d,
              href: `/${game}/standings?division=${d}${selectedSeason ? `&season=${encodeURIComponent(selectedSeason.name)}` : ''}`,
            }))}
            active={division}
            ariaLabel="Division"
          />

          {seasons.length > 1 && selectedSeason && (
            <SeasonSelect
              basePath={`/${game}/standings`}
              seasons={seasons.map((s) => ({ name: s.name, isActive: s.isActive }))}
              selected={selectedSeason.name}
              extraParams={{ division }}
            />
          )}
        </div>

        {/* Standings Table */}
        <div className="bg-surface-raised/60 border border-line rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
          {standings.length === 0 ? (
            <div className="text-center p-12 text-foreground-muted text-sm">
              No standings recorded for this season and division yet.
            </div>
          ) : isIndividual ? (
            <PlayerStandingsTable rows={standings} />
          ) : (
            <TeamStandingsTable rows={standings} />
          )}
        </div>

        {source === 'snapshot' && (
          <p className="mt-4 text-xs text-foreground-muted font-semibold">
            Final standings imported from the league archive.
          </p>
        )}
      </Section>
    </main>
  );
}
