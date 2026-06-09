import { getCachedMatches, getCachedTeams, getCachedRosters, getCachedSeasons, getCachedGames } from '@/app/lib/db/queries';
import Card from '@/app/components/ui/Card';
import MatchScheduleForm from '@/app/components/admin/MatchScheduleForm';
import MatchList from '@/app/components/admin/MatchList';
import { HiExclamationTriangle } from 'react-icons/hi2';

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
      <div className="flex items-center gap-3">
        <span className="w-1 h-6 rounded-full bg-ez-pink shrink-0" />
        <p className="text-slate-400 text-sm">Schedule matches and input scores to recalculate team standings and seasonal records.</p>
      </div>

      {dbError && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <HiExclamationTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-amber-400">Database Error</h3>
              <p className="text-slate-300 text-sm leading-relaxed mt-0.5">Failed to fetch match configurations. Please ensure database migrations have run.</p>
            </div>
          </div>
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
