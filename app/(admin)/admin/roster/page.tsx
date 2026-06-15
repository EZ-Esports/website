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
import Card from '@/app/components/ui/Card';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
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
      <Card className="border-l-4 border-l-ez-pink hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Teams & Roster Manager</h1>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Manage competitive rosters, assign players to teams, and configure game-specific lineups for each season.
        </p>
      </Card>
      {dbError ? (
        <DbErrorNotice variant="error" />
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
