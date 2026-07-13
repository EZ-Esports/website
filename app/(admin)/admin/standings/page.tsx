import { getCachedGames, getAdminSeasons, getCachedSchools } from '@/app/lib/db/queries';
import Card from '@/app/components/ui/Card';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import StandingsEditor from './StandingsEditor';
import type { DBGame, DBSchool, DBSeason } from '@/app/types';

export default async function AdminStandingsPage() {
  let games: DBGame[] = [];
  let seasons: DBSeason[] = [];
  let schools: DBSchool[] = [];
  let dbError = false;

  try {
    const [gamesRes, seasonsRes, schoolsRes] = await Promise.all([
      getCachedGames(),
      getAdminSeasons(),
      getCachedSchools(),
    ]);
    games = gamesRes;
    seasons = seasonsRes as DBSeason[];
    schools = schoolsRes;
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-accent hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Standings Archive</h1>
        <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">
          Record or correct final standings for seasons whose per-match scores were never captured.
          Active seasons with live results usually don&apos;t need snapshot rows.
        </p>
      </Card>

      {dbError ? (
        <DbErrorNotice variant="error" />
      ) : (
        <StandingsEditor games={games} seasons={seasons} schools={schools} />
      )}
    </div>
  );
}
