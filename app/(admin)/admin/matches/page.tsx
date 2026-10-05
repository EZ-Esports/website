import { getCachedTeams, getCachedRosters, getCachedSeasons, getStaffSeasons, getCachedGames, getMatchesPage } from '@/app/lib/db/queries';
import MatchScheduleForm from '@/app/components/admin/MatchScheduleForm';
import AdminMatchExplorer from '@/app/components/admin/AdminMatchExplorer';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { toMatchesPageDto, type MatchPageResponse } from '@/app/lib/db/match-page';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';

export default async function AdminMatchesPage() {
  if (!(await getStaffForAdminSection('/admin/matches'))) return <PermissionDenied />;

  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let rosters: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let activeSeasons: Awaited<ReturnType<typeof getCachedSeasons>> = [];
  let allSeasons: Awaited<ReturnType<typeof getStaffSeasons>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let initialPage: MatchPageResponse = { items: [], nextCursor: null };
  let dbError = false;

  try {
    const [firstPage, teamsRes, rostersRes, activeSeasonsRes, allSeasonsRes, gamesRes] = await Promise.all([
      getMatchesPage({ sort: 'desc', limit: 25 }),
      getCachedTeams(),
      getCachedRosters(),
      getCachedSeasons(),
      getStaffSeasons(),
      getCachedGames(),
    ]);
    initialPage = toMatchesPageDto(firstPage);
    teams = teamsRes;
    rosters = rostersRes;
    activeSeasons = activeSeasonsRes;
    allSeasons = allSeasonsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/matches"
        description="Schedule matches and input scores to recalculate team standings and seasonal records."
      />

      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Scheduling column: stays in view while scrolling a long fixture list. */}
          <AdminSection
            className="lg:sticky lg:top-20 lg:col-span-1 lg:max-h-[calc(100dvh-6rem)] lg:overflow-auto"
            title="Schedule a match"
            description="Register a new scheduled event."
          >
            <MatchScheduleForm
              seasons={activeSeasons}
              rosters={rosters as any}
              teams={teams}
              games={games}
            />
          </AdminSection>

          {/* Matches list column */}
          <div className="min-w-0 lg:col-span-2">
            <AdminMatchExplorer
              seasons={allSeasons}
              games={games}
              initialPage={initialPage}
            />
          </div>
        </div>
      )}
    </AdminPage>
  );
}
