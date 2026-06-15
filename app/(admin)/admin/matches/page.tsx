import { getAdminMatches, getCachedTeams, getCachedRosters, getCachedSeasons, getAdminSeasons, getCachedGames } from '@/app/lib/db/queries';
import Card from '@/app/components/ui/Card';
import MatchScheduleForm from '@/app/components/admin/MatchScheduleForm';
import MatchList from '@/app/components/admin/MatchList';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';

export default async function AdminMatchesPage() {
  let matches: Awaited<ReturnType<typeof getAdminMatches>> = [];
  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let rosters: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let activeSeasons: Awaited<ReturnType<typeof getCachedSeasons>> = [];
  let allSeasons: Awaited<ReturnType<typeof getAdminSeasons>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let dbError = false;

  try {
    const [matchesRes, teamsRes, rostersRes, activeSeasonsRes, allSeasonsRes, gamesRes] = await Promise.all([
      getAdminMatches(),
      getCachedTeams(),
      getCachedRosters(),
      getCachedSeasons(),
      getAdminSeasons(),
      getCachedGames(),
    ]);
    matches = matchesRes;
    teams = teamsRes;
    rosters = rostersRes;
    activeSeasons = activeSeasonsRes;
    allSeasons = allSeasonsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-ez-pink hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Matches & Standings</h1>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Schedule matches and input scores to recalculate team standings and seasonal records.</p>
      </Card>

      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Scheduling Column */}
          <Card className="lg:col-span-1 h-fit space-y-5">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Schedule Match</h2>
              <p className="text-slate-400 text-xs mt-0.5">Register a new scheduled event.</p>
            </div>

            <MatchScheduleForm
              seasons={activeSeasons}
              rosters={rosters as any}
              teams={teams}
              games={games}
            />
          </Card>

          {/* Matches List Column */}
          <div className="lg:col-span-2">
            <MatchList
              initialMatches={matches}
              seasons={allSeasons}
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
