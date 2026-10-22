import { getCachedTeams, getCachedRosters, getCachedSeasons, getStaffSeasons, getCachedGames, getMatchesPage } from '@/app/lib/db/queries';
import MatchScheduleForm from '@/app/components/admin/MatchScheduleForm';
import AdminMatchExplorer from '@/app/components/admin/AdminMatchExplorer';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { toMatchesPageDto, type MatchPageResponse } from '@/app/lib/db/match-page';
import { matchExplorerKey, parseMatchFilterParams } from '@/app/lib/admin-season-filters';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string | string[]; game?: string | string[] }>;
}) {
  if (!(await getStaffForAdminSection('/admin/matches'))) return <PermissionDenied />;

  const rawParams = await searchParams;

  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let rosters: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let activeSeasons: Awaited<ReturnType<typeof getCachedSeasons>> = [];
  let allSeasons: Awaited<ReturnType<typeof getStaffSeasons>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let initialPage: MatchPageResponse = { items: [], nextCursor: null };
  let initialFilters = { gameId: '', seasonId: '' };
  let dbError = false;

  try {
    // Game and season come first: the URL filters decide which first page to load.
    const [allSeasonsRes, gamesRes] = await Promise.all([getStaffSeasons(), getCachedGames()]);
    initialFilters = parseMatchFilterParams(rawParams, gamesRes, allSeasonsRes);
    const [firstPage, teamsRes, rostersRes, activeSeasonsRes] = await Promise.all([
      // Raw staff read (spec-022): never the redacting public query.
      getMatchesPage({
        sort: 'desc',
        limit: 25,
        gameId: initialFilters.gameId || undefined,
        seasonId: initialFilters.seasonId || undefined,
      }),
      getCachedTeams(),
      getCachedRosters(),
      getCachedSeasons(),
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
              key={matchExplorerKey(initialFilters.gameId, initialFilters.seasonId)}
              seasons={allSeasons}
              games={games}
              initialPage={initialPage}
              initialGameId={initialFilters.gameId}
              initialSeasonId={initialFilters.seasonId}
            />
          </div>
        </div>
      )}
    </AdminPage>
  );
}
