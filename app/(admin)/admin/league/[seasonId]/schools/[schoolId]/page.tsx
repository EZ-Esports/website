import { notFound } from 'next/navigation';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import SchoolCrest from '@/app/components/admin/SchoolCrest';
import SchoolRostersView from '@/app/components/admin/SchoolRostersView';
import { AdminNotice, AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';
import { chip } from '@/app/components/admin/styles';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { hasPermission, Permissions } from '@/app/lib/roles';
import { ADMIN_ROSTER_VIEW_PERMISSION } from '@/app/lib/staff-access';
import { getSeasonSetupData, type SeasonSetupData } from '@/app/lib/db/season-setup';
import { getRosterEditOptions, getSchoolRosterBlocks } from '@/app/lib/db/school-rosters';
import type { RosterEditOptions, SeasonBlock } from '@/app/lib/school-roster-view';

const NO_OPTIONS: RosterEditOptions = { members: [], games: [], seasons: [] };

const UUID =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One school's rosters for one season of one game, reached from a school tile on the season page.
 * Gated on MANAGE_LEAGUE like the season page. The roster data (player names, Discord, class year,
 * school email, student ID links, content-flag badges) is the same Schools & Rosters shows, so it is
 * loaded and drawn only for staff holding MANAGE_ROSTERS, the permission that page requires; it is
 * the same `SchoolRostersView` in its `season` scope: one block, no game filter, season
 * header or register-team panel, but all roster and player controls. Only this
 * season's team is ever queried, so no other game's data reaches the client. Everyone else gets the
 * names-and-roles list the season page already offers.
 */
export default async function SeasonSchoolPage({ params }: { params: Promise<{ seasonId: string; schoolId: string }> }) {
  const staff = await getStaffForAdminSection('/admin/league');
  if (!staff) return <PermissionDenied />;

  const { seasonId, schoolId } = await params;
  if (!UUID.test(seasonId) || !UUID.test(schoolId)) notFound();

  const canViewRosterData = hasPermission(staff.permissions, staff.isOwner, ADMIN_ROSTER_VIEW_PERMISSION);
  const canManageSchools = hasPermission(staff.permissions, staff.isOwner, Permissions.MANAGE_SCHOOLS);

  let data: SeasonSetupData | null = null;
  let block: SeasonBlock | null = null;
  let options: RosterEditOptions = NO_OPTIONS;
  let dbError = false;
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    data = await getSeasonSetupData(seasonId);
    if (data?.schools.some((s) => s.schoolId === schoolId) && canViewRosterData) {
      // Season-scoped at the query: only this season's team (hence only this game's) is read. The
      // URL's ?game= is never consulted; the season decides the game. A block that still did not
      // belong to this season and game would be dropped rather than shown.
      const gameSlug = data.season.gameSlug;
      const [blocks, editOptions] = await Promise.all([
        getSchoolRosterBlocks(schoolId, { seasonId }),
        getRosterEditOptions(schoolId, { seasonId }),
      ]);
      options = editOptions;
      block = blocks.find((b) => b.seasonId === seasonId && b.gameSlug === gameSlug) ?? null;
    }
  } catch (error) {
    console.error('Error loading season school:', error);
    dbError = true;
  }

  if (dbError) {
    return (
      <AdminPage>
        <AdminPageHeader eyebrow="League Operations" title="School" back={{ href: `/admin/league/${seasonId}`, label: 'Season' }} />
        <DbErrorNotice variant="error" />
      </AdminPage>
    );
  }

  const school = data?.schools.find((s) => s.schoolId === schoolId);
  if (!data || !school) notFound();
  const { season } = data;
  const playerTotal = school.rosters.reduce((n, r) => n + r.players.length, 0);

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="League Operations"
        title={school.schoolName}
        description={`${season.gameName} ${season.name}: this school's rosters for the season.`}
        back={{ href: `/admin/league/${season.id}`, label: `${season.gameName} ${season.name}` }}
        meta={
          <>
            <SchoolCrest name={school.schoolName} logoUrl={school.logoUrl} size="lg" />
            <span className={chip('neutral')}>
              {school.rosters.length} {school.rosters.length === 1 ? 'roster' : 'rosters'} · {playerTotal} {playerTotal === 1 ? 'player' : 'players'}
            </span>
            {school.missing.map((d) => (
              <span key={d} className={chip('warning')}>No {d} roster</span>
            ))}
            {season.rostersLockedAt && <span className={chip('warning')}>Rosters locked</span>}
          </>
        }
      />

      {canViewRosterData ? (
        block ? (
          <AdminSection title="Rosters">
            <SchoolRostersView
              schoolId={school.schoolId}
              schoolName={school.schoolName}
              blocks={[block]}
              // Season-scoped editor options: this season, its one game and the school's members. No
              // other game or season is read or sent.
              options={options}
              scope="season"
              initialFilters={{ game: '', division: 'both', phone: 'Varsity' }}
            />
          </AdminSection>
        ) : (
          <DbErrorNotice variant="error" />
        )
      ) : (
        <AdminSection title="Rosters">
          <AdminNotice tone="info" className="mb-4">
            Player details (Discord, class year, school email, student ID) need the roster permission
            {canManageSchools ? '.' : ', and manager tools need the schools permission.'}
          </AdminNotice>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {school.rosters.map((r) => (
              <section key={r.id} aria-label={`${r.name} roster`} className="rounded-xl bg-surface-sunken p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {r.name}
                  <span className="ml-2 text-xs font-normal text-foreground-secondary">{r.players.length}</span>
                </h3>
                {r.players.length === 0 ? (
                  <p className="mt-2 text-sm text-foreground-secondary">No players on this roster.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line/50">
                    {r.players.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm text-foreground">
                        <span className="truncate">{p.name}</span>
                        <span className={`${chip('neutral', 'sm')} capitalize`}>{p.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </AdminSection>
      )}
    </AdminPage>
  );
}
