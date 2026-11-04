import { notFound } from 'next/navigation';
import SeasonSetupClient from './SeasonSetupClient';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';
import { chip } from '@/app/components/admin/styles';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { hasPermission, Permissions } from '@/app/lib/roles';
import { seasonMatchesHref, leagueHref, seasonTab } from '@/app/lib/admin-season-filters';
import { getSeasonSetupData, type SeasonSetupData } from '@/app/lib/db/season-setup';
import { getLeagueAdminData } from '@/app/lib/db/queries';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One season of one game: its schools and their rosters, manager invite links, the roster lock and
 * publishing. Gated on MANAGE_LEAGUE like League Setup; the invite and roster-editor shortcuts
 * additionally need MANAGE_SCHOOLS / MANAGE_ROSTERS and are only drawn for staff who hold them
 * (the actions behind them check again).
 */
export default async function SeasonSetupPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const staff = await getStaffForAdminSection('/admin/league');
  if (!staff) return <PermissionDenied />;

  const { seasonId } = await params;
  if (!UUID.test(seasonId)) notFound();

  let data: SeasonSetupData | null = null;
  let games: Array<{ id: string; displayName: string; slug: string }> = [];
  let dbError = false;
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    [data, { games }] = await Promise.all([getSeasonSetupData(seasonId), getLeagueAdminData()]);
  } catch (error) {
    console.error('Error loading season setup:', error);
    dbError = true;
  }
  if (!dbError && !data) notFound();

  if (dbError || !data) {
    return (
      <AdminPage>
        <AdminPageHeader eyebrow="League Operations" title="Season" back={{ href: leagueHref(), label: 'League Setup' }} />
        <DbErrorNotice variant="error" />
      </AdminPage>
    );
  }

  const { season } = data;
  const published = !!season.outcomesFinalizedAt;
  const locked = !!season.rostersLockedAt;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="League Operations"
        title={`${season.gameName} ${season.name}`}
        description="Schools and rosters for this season, manager invite links, the roster lock and public results."
        back={{
          href: leagueHref({ game: season.gameSlug, status: seasonTab(season.isActive) }),
          label: `League Setup · ${season.gameName}`,
        }}
        meta={
          <>
            <span className={chip(season.isActive ? 'success' : 'neutral')}>{season.isActive ? 'Active' : 'Inactive'}</span>
            <span className={`${chip('neutral')} capitalize`}>{season.standingsFormat} standings</span>
            <span className={chip(published ? 'success' : 'neutral')}>{published ? 'Season published' : 'Season unpublished'}</span>
            {locked && <span className={chip('warning')}>Rosters locked</span>}
          </>
        }
      />
      <SeasonSetupClient
        season={{
          ...season,
          rostersLockedAt: season.rostersLockedAt ? season.rostersLockedAt.toISOString() : null,
          outcomesFinalizedAt: season.outcomesFinalizedAt ? season.outcomesFinalizedAt.toISOString() : null,
        }}
        schools={data.schools}
        availableSchools={data.availableSchools}
        games={games}
        canInvite={hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_SCHOOLS)}
        canEditRosters={hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_ROSTERS)}
        matchesHref={seasonMatchesHref(season.id, season.gameSlug)}
      />
    </AdminPage>
  );
}
