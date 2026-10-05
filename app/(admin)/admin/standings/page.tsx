import { getCachedGames, getStaffSeasons, getCachedSchools } from '@/app/lib/db/queries';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import StandingsEditor from './StandingsEditor';
import type { DBGame, DBSchool, DBSeason } from '@/app/types';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';

export default async function AdminStandingsPage() {
  if (!(await getStaffForAdminSection('/admin/standings'))) return <PermissionDenied />;

  let games: DBGame[] = [];
  let seasons: DBSeason[] = [];
  let schools: DBSchool[] = [];
  let dbError = false;

  try {
    const [gamesRes, seasonsRes, schoolsRes] = await Promise.all([
      getCachedGames(),
      getStaffSeasons(),
      getCachedSchools(),
    ]);
    games = gamesRes;
    seasons = seasonsRes as DBSeason[];
    schools = schoolsRes;
  } catch {
    dbError = true;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/standings"
        description={
          <>
            Record or correct final standings for seasons whose per-match scores were never captured.
            Active seasons with live results usually don&apos;t need snapshot rows.
          </>
        }
      />

      {dbError ? (
        <DbErrorNotice variant="error" />
      ) : (
        <StandingsEditor games={games} seasons={seasons} schools={schools} />
      )}
    </AdminPage>
  );
}
