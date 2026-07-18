import {
  getCachedRosters,
  getCachedTeams,
  getCachedGames,
  getCachedSchools,
  getStaffSeasons,
  getRosterPlayerCounts,
} from '@/app/lib/db/queries';
import { Suspense } from 'react';
import RosterExplorer from '@/app/components/admin/RosterExplorer';
import Card from '@/app/components/ui/Card';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { DBGame, DBTeam, DBRoster, DBSchool, DBSeason } from '@/app/types';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';

export default async function AdminRosterPage() {
  if (!(await getStaffForAdminSection('/admin/roster'))) return <PermissionDenied />;

  let rosters: DBRoster[] = [];
  let teams: DBTeam[] = [];
  let games: DBGame[] = [];
  let schools: DBSchool[] = [];
  let seasons: DBSeason[] = [];
  let playerCounts: Record<string, number> = {};
  let dbError = false;

  try {
    // Members and players are intentionally NOT loaded here: RosterExplorer
    // fetches them on demand per school/roster (they are the two big tables).
    const [rostersRes, teamsRes, gamesRes, schoolsRes, seasonsRes, countsRes] = await Promise.all([
      getCachedRosters(),
      getCachedTeams(),
      getCachedGames(),
      getCachedSchools(),
      getStaffSeasons(),
      getRosterPlayerCounts(),
    ]);
    rosters = rostersRes as any;
    teams = teamsRes;
    games = gamesRes;
    schools = schoolsRes;
    seasons = seasonsRes as any;
    playerCounts = countsRes;
  } catch (error) {
    console.error('Error fetching league configuration data:', error);
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-accent hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Teams & Roster Manager</h1>
        <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">
          Manage competitive rosters, assign players to teams, and configure game-specific lineups for each season.
        </p>
      </Card>
      {dbError ? (
        <DbErrorNotice variant="error" />
      ) : (
        <Suspense fallback={<div className="text-foreground-muted text-sm">Loading…</div>}>
          <RosterExplorer
            games={games}
            teams={teams}
            rosters={rosters}
            schools={schools}
            seasons={seasons}
            playerCounts={playerCounts}
          />
        </Suspense>
      )}
    </div>
  );
}
