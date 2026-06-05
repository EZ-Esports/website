import { getCachedMatches, getCachedTeams, getCachedRosters, getCachedSeasons, getCachedGames } from '@/app/lib/db/queries';
import Card from '@/app/components/ui/Card';
import MatchScheduleForm from '@/app/components/admin/MatchScheduleForm';
import MatchList from '@/app/components/admin/MatchList';

export default async function AdminMatchesPage() {
  let matches: Awaited<ReturnType<typeof getCachedMatches>> = [];
  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let rosters: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let seasons: Awaited<ReturnType<typeof getCachedSeasons>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let dbError = false;

  try {
    const [matchesRes, teamsRes, rostersRes, seasonsRes, gamesRes] = await Promise.all([
      getCachedMatches(),
      getCachedTeams(),
      getCachedRosters(),
      getCachedSeasons(),
      getCachedGames(),
    ]);
    matches = matchesRes;
    teams = teamsRes;
    rosters = rostersRes;
    seasons = seasonsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="hover:shadow-none duration-300">
        <h1 className="text-xl font-bold text-white uppercase tracking-wider">Matches & Standings Manager</h1>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
          Schedule matches and input scores to recalculate team standings and seasonal records.
        </p>
      </Card>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch match configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Scheduling Column */}
          <Card className="lg:col-span-1 h-fit space-y-5">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Schedule Match</h2>
              <p className="text-slate-400 text-xs mt-0.5">Register a new scheduled event.</p>
            </div>

            <MatchScheduleForm 
              seasons={seasons}
              rosters={rosters as any}
              teams={teams}
              games={games}
            />
          </Card>

          {/* Matches List Column */}
          <div className="lg:col-span-2">
            <MatchList 
              initialMatches={matches}
              seasons={seasons}
              rosters={rosters as any}
              teams={teams}
              games={games}
            />
          </div>
          
        </div>
      )}
    </div>
  );
}
