import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import FilterTabs from '@/app/components/ui/FilterTabs';
import { Table, Th, Td, Tr } from '@/app/components/ui/Table';
import { getSeasonDivisions, getSeasonStandingsFor, getSeasonsWithGames } from '@/app/lib/db/queries';
import {
  COMBINED_DIVISION,
  isDerivedStandings,
  pointsFromNotes,
  resolveSelectedSeason,
  standingsTeamLabel,
  type StandingRow,
  type StandingsFormat,
} from '@/app/lib/db/match-page';
import SeasonSelect from '@/app/components/ui/SeasonSelect';
import MigrationNotice from '@/app/components/ui/MigrationNotice';
import SeasonFormatNotice from '@/app/components/ui/SeasonFormatNotice';


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

function TeamStandingsTable({
  rows,
  standingsFormat,
}: {
  rows: StandingRow[];
  standingsFormat: StandingsFormat;
}) {
  /*
   * Only a combined table names the squad on each row (`standingsTeamLabel`
   * decides, for this page and the game hub alike). In a divided season the
   * division is the active tab directly above this table, so repeating it on
   * every row would say once more what the heading already says — the tautology
   * PR #46 took off the match tiles. Here it is the opposite: three schools
   * entered two squads, so without it three names appear twice, identically, at
   * two different ranks.
   */
  return (
    <Table>
      <thead className="bg-surface-sunken/60 border-b border-line">
        <tr>
          <Th>Rank</Th>
          <Th>Team</Th>
          <Th>Record</Th>
          <Th>Win Percentage</Th>
          <Th>Games</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((entry) => (
          // The division is part of the key: in a combined table one school is
          // two rows, and rank can be null on an unranked snapshot.
          <Tr key={`${entry.rank}-${entry.division}-${entry.schoolName}`} interactive>
            <Td className="font-bold">
              <RankCell rank={entry.rank} />
            </Td>
            <Td className="font-bold text-foreground">
              {standingsTeamLabel(entry, standingsFormat)}
            </Td>
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
  let standingsFormat: StandingsFormat = 'divided';
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
      if (result.standingsFormat === 'combined') {
        // A combined season offers exactly one tab, and the fetch above already
        // returned the whole table — it ignores the requested division entirely
        // — so the tab moves onto `Combined` with no second query. Without this
        // the default `?division=Varsity` would refetch the identical rows just
        // to arrive at the same place.
        division = COMBINED_DIVISION;
      } else if (!divisions.includes(division)) {
        division = divisions[0];
        effective = await getSeasonStandingsFor(selectedSeason.id, division);
      }
      standings = effective.rows;
      source = effective.source;
      standingsFormat = effective.standingsFormat;
    }
  } catch (error) {
    console.error('Failed to load standings from database', error);
  }

  const isIndividual = standings.some((row) => row.playerName !== null);
  const isArchived = Boolean(selectedSeason && !selectedSeason.isActive);
  /**
   * Derived rows live in `season_standings` and so come back as
   * `source: 'snapshot'`, which is why the caption below *replaces* the archive
   * sentence rather than joining it. "Imported from the league archive" is a
   * false claim about a table this pipeline tallied from match rows itself, and
   * the difference is exactly what a reader needs to weigh the numbers.
   */
  const isReconstructedTable = isDerivedStandings(standings);

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
        <MigrationNotice />

        {/* Filters: division tabs + season picker */}
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <FilterTabs
            tabs={divisions.map((d) => ({
              label:
                d === 'All'
                  ? 'Players'
                  : d === 'JV'
                    ? 'Junior Varsity'
                    : d === COMBINED_DIVISION
                      ? 'Combined table'
                      : d,
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

        {/* Sits directly above the table it explains, not up with the system
            notice: it answers "why is one school here twice, and where did the
            division tabs go" at the moment the reader asks it. */}
        {standingsFormat === 'combined' && <SeasonFormatNotice className="mb-4" />}

        {/* Standings Table */}
        <div className="bg-surface-raised/60 border border-line rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
          {standings.length === 0 ? (
            <div className="text-center p-12 text-foreground-muted text-sm">
              No standings recorded for this season and division yet.
            </div>
          ) : isIndividual ? (
            <PlayerStandingsTable rows={standings} />
          ) : (
            <TeamStandingsTable rows={standings} standingsFormat={standingsFormat} />
          )}
        </div>

        {isReconstructedTable ? (
          <p className="mt-4 text-xs text-foreground-muted font-semibold">
            Reconstructed from match results
          </p>
        ) : (
          source === 'snapshot' && (
            <p className="mt-4 text-xs text-foreground-muted font-semibold">
              Final standings imported from the league archive.
            </p>
          )
        )}
      </Section>
    </main>
  );
}
