import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import { getSeasonDivisions, getSeasonStandingsFor, getSeasonsWithGames } from '@/app/lib/db/queries';
import { pointsFromNotes, resolveSelectedSeason, type StandingRow } from '@/app/lib/db/match-page';
import Link from 'next/link';
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

const MEDALS: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '🏆', color: 'text-yellow-500' },
  2: { emoji: '🥈', color: 'text-slate-400' },
  3: { emoji: '🥉', color: 'text-amber-600' },
};

function RankCell({ rank }: { rank: number | null }) {
  const medal = rank !== null ? MEDALS[rank] : undefined;
  if (!medal) return <>{rank ?? '—'}</>;
  return (
    <span className={`${medal.color} font-bold`}>
      <span aria-hidden="true">{medal.emoji} </span>
      <span>{rank}</span>
    </span>
  );
}

const headerCell = 'px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest';

function TeamStandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead className="bg-[#0b101d] border-b border-slate-800/80">
        <tr>
          <th className={headerCell}>Rank</th>
          <th className={headerCell}>Team</th>
          <th className={headerCell}>W-L</th>
          <th className={headerCell}>Win %</th>
          <th className={headerCell}>Games</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((entry) => (
          <tr key={`${entry.rank}-${entry.schoolName}`} className="hover:bg-slate-800/10 transition-colors">
            <td className="px-6 py-4 text-sm font-bold text-slate-300">
              <RankCell rank={entry.rank} />
            </td>
            <td className="px-6 py-4 text-sm font-bold text-white">{entry.schoolName}</td>
            <td className="px-6 py-4 text-sm font-medium text-slate-400">
              {entry.wins ?? 0}-{entry.losses ?? 0}
            </td>
            <td className="px-6 py-4 text-sm font-bold text-white">
              {entry.winPct !== null ? `${(entry.winPct * 100).toFixed(1)}%` : '—'}
            </td>
            <td className="px-6 py-4 text-sm font-medium text-slate-400">{entry.gamesPlayed ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Individual (per-player) standings, e.g. TFT point leaderboards. */
function PlayerStandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead className="bg-[#0b101d] border-b border-slate-800/80">
        <tr>
          <th className={headerCell}>Rank</th>
          <th className={headerCell}>Player</th>
          <th className={headerCell}>School</th>
          <th className={headerCell}>Points</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((entry) => (
          <tr key={`${entry.rank}-${entry.playerName}`} className="hover:bg-slate-800/10 transition-colors">
            <td className="px-6 py-4 text-sm font-bold text-slate-300">
              <RankCell rank={entry.rank} />
            </td>
            <td className="px-6 py-4 text-sm font-bold text-white">
              {entry.playerName}
              {entry.playerIgn && <span className="text-slate-500 font-medium ml-2">{entry.playerIgn}</span>}
            </td>
            <td className="px-6 py-4 text-sm font-medium text-slate-400">{entry.schoolName}</td>
            <td className="px-6 py-4 text-sm font-bold text-white">{pointsFromNotes(entry.notes) ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <h1 className="sr-only">{gameConfig.displayName} Standings — EZ Esports</h1>
      <ContentSection
        heading={`${gameConfig.displayName} Standings`}
        description={
          isArchived
            ? `Final standings from the ${selectedSeason?.name} season`
            : 'Current season standings for all teams'
        }
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Filters: division tabs + season picker */}
          <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex gap-2">
              {divisions.map((d) => (
                <Link
                  key={d}
                  href={`/${game}/standings?division=${d}${selectedSeason ? `&season=${encodeURIComponent(selectedSeason.name)}` : ''}`}
                  className={`px-5 py-2.5 min-h-[44px] flex items-center text-sm font-bold rounded-lg transition-all ${
                    division === d
                      ? 'bg-ez-pink text-ez-black hover:bg-ez-pink/80'
                      : 'bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {d === 'All' ? 'Players' : d}
                </Link>
              ))}
            </div>

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
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {standings.length === 0 ? (
              <div className="text-center p-12 text-slate-500 text-sm">
                No standings recorded for this season and division yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                {isIndividual ? (
                  <PlayerStandingsTable rows={standings} />
                ) : (
                  <TeamStandingsTable rows={standings} />
                )}
              </div>
            )}
          </div>

          {source === 'snapshot' && (
            <p className="mt-4 text-xs text-slate-600 font-semibold">
              Final standings imported from the league archive.
            </p>
          )}
        </div>
      </ContentSection>
    </main>
  );
}
