import { notFound } from 'next/navigation';
import { getStaffWithPermission } from '@/app/lib/auth';
import { ADMIN_ROSTER_VIEW_PERMISSION } from '@/app/lib/staff-access';
import { getRosterEditOptions, getSchoolForRosterView, getSchoolRosterBlocks } from '@/app/lib/db/school-rosters';
import { parseRosterFilters, type RosterEditOptions, type SeasonBlock } from '@/app/lib/school-roster-view';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import SchoolRostersView from '@/app/components/admin/SchoolRostersView';
import { AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SchoolRostersPageProps {
  params: Promise<{ schoolId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Roster view and editor for one school. Gated on MANAGE_ROSTERS rather than
 * MANAGE_SCHOOLS: a staff member who can manage schools but not rosters is
 * denied before any roster query runs, so edit controls never render for them.
 * The game / division filters come from the URL and are validated here.
 */
export default async function SchoolRostersPage({ params, searchParams }: SchoolRostersPageProps) {
  if (!(await getStaffWithPermission(ADMIN_ROSTER_VIEW_PERMISSION))) return <PermissionDenied />;

  const { schoolId } = await params;
  if (!UUID.test(schoolId)) notFound();

  let school: { id: string; name: string } | null = null;
  let blocks: SeasonBlock[] = [];
  let options: RosterEditOptions = { members: [], games: [], seasons: [] };
  let dbError = false;
  try {
    school = await getSchoolForRosterView(schoolId);
    if (school) {
      [blocks, options] = await Promise.all([getSchoolRosterBlocks(schoolId), getRosterEditOptions(schoolId)]);
    }
  } catch (error) {
    console.error('Error loading school rosters:', error);
    dbError = true;
  }
  if (!dbError && !school) notFound();

  const filters = parseRosterFilters(
    (await searchParams) ?? {},
    blocks.map((b) => b.gameSlug),
  );

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="League Operations"
        title={school ? `${school.name} rosters` : 'School rosters'}
        description="Every roster this school has fielded, newest season first. Add, change and remove teams, rosters and players here; staff edits are not blocked by a season's roster lock."
        back={{ href: '/admin/schools', label: 'Schools & Rosters' }}
      />
      {dbError || !school ? (
        <DbErrorNotice variant="error" />
      ) : (
        <AdminSection title="Rosters by season">
          <SchoolRostersView schoolId={school.id} schoolName={school.name} blocks={blocks} options={options} initialFilters={filters} />
        </AdminSection>
      )}
    </AdminPage>
  );
}
