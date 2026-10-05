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
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { DBGame, DBTeam, DBRoster, DBSchool, DBSeason } from '@/app/types';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader, AdminSkeleton, AdminSkeletonRows } from '@/app/components/admin/AdminUI';

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
    <AdminPage>
      <AdminPageHeader
        route="/admin/roster"
        description="Manage competitive rosters, assign players to teams, and configure game-specific lineups for each season."
      />
      {dbError ? (
        <DbErrorNotice variant="error" />
      ) : (
        <Suspense
          fallback={
            <div className="admin-skeleton-enter space-y-4" role="status" aria-live="polite">
              <span className="sr-only">Loading…</span>
              <AdminSkeleton className="h-9 w-80 rounded-lg" />
              <div className="rounded-2xl bg-admin-panel py-2">
                <AdminSkeletonRows rows={5} />
              </div>
            </div>
          }
        >
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
    </AdminPage>
  );
}
