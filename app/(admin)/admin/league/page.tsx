import LeagueSetupClient from './LeagueSetupClient';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { parseSeasonStatus, resolveLeagueView, sortGamesForLeagueTabs } from '@/app/lib/admin-season-filters';
import { getLeagueAdminData } from '@/app/lib/db/queries';
import { AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';

export default async function LeagueSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; game?: string | string[]; view?: string | string[] }>;
}) {
  if (!(await getStaffForAdminSection('/admin/league'))) return <PermissionDenied />;

  const params = await searchParams;
  const status = parseSeasonStatus(params.status);

  let games: Awaited<ReturnType<typeof getLeagueAdminData>>['games'] = [];
  let seasons: Awaited<ReturnType<typeof getLeagueAdminData>>['seasons'] = [];
  let dbError = false;

  try {
    if (process.env.DATABASE_URL) {
      const res = await getLeagueAdminData();
      games = sortGamesForLeagueTabs(res.games);
      seasons = res.seasons;
    } else {
      dbError = true;
    }
  } catch {
    dbError = true;
  }

  const view = resolveLeagueView(params.game, params.view, games);

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/league"
        description="Run each game's seasons in one place. Pick a game, open a season, and add its schools, check rosters, invite managers, lock rosters and publish results there."
      />

      {dbError && <DbErrorNotice variant="not-configured" />}

      {!dbError && <LeagueSetupClient games={games} seasons={seasons} view={view} seasonStatus={status} />}
    </AdminPage>
  );
}
