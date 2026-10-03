import LeagueSetupClient from './LeagueSetupClient';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { getLeagueAdminData } from '@/app/lib/db/queries';
import { AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';

export default async function LeagueSetupPage() {
  if (!(await getStaffForAdminSection('/admin/league'))) return <PermissionDenied />;

  let games: Awaited<ReturnType<typeof getLeagueAdminData>>['games'] = [];
  let seasons: Awaited<ReturnType<typeof getLeagueAdminData>>['seasons'] = [];
  let dbError = false;

  try {
    if (process.env.DATABASE_URL) {
      const res = await getLeagueAdminData();
      games = res.games;
      seasons = res.seasons;
    } else {
      dbError = true;
    }
  } catch {
    dbError = true;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/league"
        description="Create games and seasons before scheduling matches or registering teams. Every match and team registration depends on at least one game and one active season."
      />

      {dbError && <DbErrorNotice variant="not-configured" />}

      {!dbError && <LeagueSetupClient games={games} seasons={seasons} />}
    </AdminPage>
  );
}
