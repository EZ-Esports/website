import { 
  getCachedPlayers, 
  getCachedRosters, 
  getCachedTeams, 
  getCachedGames, 
  getCachedSchools, 
  getCachedMembers,
  getCachedSeasons
} from '@/app/lib/db/queries';
import { Suspense } from 'react';
import RosterExplorer from '@/app/components/admin/RosterExplorer';
import { DBGame, DBTeam, DBRoster, DBPlayer, DBSchool, DBMember, DBSeason } from '@/app/types';

export default async function AdminRosterPage() {
  let playersList: DBPlayer[] = [];
  let rosters: DBRoster[] = [];
  let teams: DBTeam[] = [];
  let games: DBGame[] = [];
  let schools: DBSchool[] = [];
  let members: DBMember[] = [];
  let seasons: DBSeason[] = [];
  let dbError = false;

  try {
    const [playersRes, rostersRes, teamsRes, gamesRes, schoolsRes, membersRes, seasonsRes] = await Promise.all([
      getCachedPlayers(),
      getCachedRosters(),
      getCachedTeams(),
      getCachedGames(),
      getCachedSchools(),
      getCachedMembers(),
      getCachedSeasons(),
    ]);
    playersList = playersRes;
    rosters = rostersRes as any;
    teams = teamsRes;
    games = gamesRes;
    schools = schoolsRes;
    members = membersRes;
    seasons = seasonsRes as any;
  } catch (error) {
    console.error('Error fetching league configuration data:', error);
    dbError = true;
  }

  return (
    <div className="space-y-6">
      {dbError ? (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch database configurations. Please ensure database migrations and seeds have run properly.
        </div>
      ) : (
        <Suspense fallback={<div className="text-slate-500 text-sm">Loading…</div>}>
          <RosterExplorer
            games={games}
            teams={teams}
            rosters={rosters}
            players={playersList}
            schools={schools}
            members={members}
            seasons={seasons}
          />
        </Suspense>
      )}
    </div>
  );
}
