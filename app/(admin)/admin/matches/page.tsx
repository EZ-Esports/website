import { getCachedTeams, getCachedRosters, getCachedSeasons, getStaffSeasons, getCachedGames, getMatchesPage, getMatchTabCounts } from '@/app/lib/db/queries';
import AdminMatchExplorer from '@/app/components/admin/AdminMatchExplorer';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { defaultSortForTab, toMatchesPageDto, type MatchPageResponse, type MatchTabCounts } from '@/app/lib/db/match-page';
import { defaultMatchTab, matchesBackLink, parseMatchFilterParams } from '@/app/lib/admin-season-filters';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';
import RescheduleQueue from '@/app/components/admin/RescheduleQueue';
import { getStaffRescheduleQueue } from '@/app/lib/db/reschedules';
import type { StaffRescheduleItem } from '@/app/lib/reschedule-rules';

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string | string[]; game?: string | string[]; from?: string | string[] }>;
}) {
  if (!(await getStaffForAdminSection('/admin/matches'))) return <PermissionDenied />;

  const rawParams = await searchParams;
  const initialTab = defaultMatchTab(rawParams);

  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let rosters: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let activeSeasons: Awaited<ReturnType<typeof getCachedSeasons>> = [];
  let allSeasons: Awaited<ReturnType<typeof getStaffSeasons>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let initialPage: MatchPageResponse = { items: [], nextCursor: null };
  let initialCounts: MatchTabCounts | null = null;
  let initialFilters = { gameId: '', seasonId: '' };
  let rescheduleQueue: StaffRescheduleItem[] = [];
  let dbError = false;
  // One clock for the first page, the totals and the first render, so the three agree on what is overdue.
  const now = new Date();

  try {
    // Game and season come first: the URL filters decide which first page to load.
    const [allSeasonsRes, gamesRes] = await Promise.all([getStaffSeasons(), getCachedGames()]);
    initialFilters = parseMatchFilterParams(rawParams, gamesRes, allSeasonsRes);
    const facets = {
      gameId: initialFilters.gameId || undefined,
      seasonId: initialFilters.seasonId || undefined,
    };
    const [firstPage, counts, teamsRes, rostersRes, activeSeasonsRes, queueRes] = await Promise.all([
      // Raw staff read (spec-022): never the redacting public query.
      getMatchesPage({ ...facets, tab: initialTab, now, sort: defaultSortForTab(initialTab), limit: 25 }),
      getMatchTabCounts({ ...facets, now }),
      getCachedTeams(),
      getCachedRosters(),
      getCachedSeasons(),
      // Fail soft: a problem with the queue must not take the results page down with it.
      getStaffRescheduleQueue().catch((error) => {
        console.error('Failed to load reschedule requests', error);
        return [] as StaffRescheduleItem[];
      }),
    ]);
    rescheduleQueue = queueRes;
    initialPage = toMatchesPageDto(firstPage);
    initialCounts = counts;
    teams = teamsRes;
    rosters = rostersRes;
    activeSeasons = activeSeasonsRes;
    allSeasons = allSeasonsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <AdminPage>
        <AdminPageHeader route="/admin/matches" description="Enter results for matches that have been played, and schedule what is next." />
        <DbErrorNotice variant="error" />
      </AdminPage>
    );
  }

  return (
    <AdminMatchExplorer
      seasons={allSeasons}
      games={games}
      initialPage={initialPage}
      initialFilters={initialFilters}
      initialTab={initialTab}
      initialCounts={initialCounts}
      serverNow={now.toISOString()}
      back={matchesBackLink(rawParams.from, allSeasons.find((s) => s.id === initialFilters.seasonId)) ?? undefined}
      scheduleForm={{
        seasons: activeSeasons,
        // The form narrows its own roster shape; the cached query returns the full rows.
        rosters: rosters as React.ComponentProps<typeof AdminMatchExplorer>['scheduleForm']['rosters'],
        teams,
        games,
      }}
    >
      <RescheduleQueue items={rescheduleQueue} />
    </AdminMatchExplorer>
  );
}
