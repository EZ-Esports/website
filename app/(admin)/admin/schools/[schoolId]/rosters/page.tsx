import { notFound } from 'next/navigation';
import { getStaffWithPermission } from '@/app/lib/auth';
import { ADMIN_ROSTER_VIEW_PERMISSION } from '@/app/lib/staff-access';
import { getSchoolForRosterView, getSchoolRosterBlocks } from '@/app/lib/db/school-rosters';
import type { SeasonBlock } from '@/app/lib/school-roster-view';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import SchoolRostersView from '@/app/components/admin/SchoolRostersView';
import { AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SchoolRostersPageProps {
  params: Promise<{ schoolId: string }>;
}

/**
 * Read-only roster view for one school. Gated on MANAGE_ROSTERS rather than
 * MANAGE_SCHOOLS: a staff member who can manage schools but not rosters is
 * denied before any roster query runs.
 */
export default async function SchoolRostersPage({ params }: SchoolRostersPageProps) {
  if (!(await getStaffWithPermission(ADMIN_ROSTER_VIEW_PERMISSION))) return <PermissionDenied />;

  const { schoolId } = await params;
  if (!UUID.test(schoolId)) notFound();

  let school: { id: string; name: string } | null = null;
  let blocks: SeasonBlock[] = [];
  let dbError = false;
  try {
    school = await getSchoolForRosterView(schoolId);
    if (school) blocks = await getSchoolRosterBlocks(schoolId);
  } catch (error) {
    console.error('Error loading school rosters:', error);
    dbError = true;
  }
  if (!dbError && !school) notFound();

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="League Operations"
        title={school ? `${school.name} rosters` : 'School rosters'}
        description="Every roster this school has fielded, newest season first. Read-only: the manager portal is where rosters are changed."
        back={{ href: '/admin/schools', label: 'Schools' }}
      />
      {dbError || !school ? (
        <DbErrorNotice variant="error" />
      ) : (
        <AdminSection title="Rosters by season">
          <SchoolRostersView schoolName={school.name} blocks={blocks} />
        </AdminSection>
      )}
    </AdminPage>
  );
}
