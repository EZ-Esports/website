import {
  getCachedLeadership,
  getCachedPeople,
} from '@/app/lib/db/queries';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import LeadershipManagerClient from '@/app/components/admin/LeadershipManagerClient';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader } from '@/app/components/admin/AdminUI';
import { chip } from '@/app/components/admin/styles';

export default async function AdminLeadershipPage() {
  if (!(await getStaffForAdminSection('/admin/leadership'))) return <PermissionDenied />;

  let leadershipList: Awaited<ReturnType<typeof getCachedLeadership>> = [];
  let peopleList: Awaited<ReturnType<typeof getCachedPeople>> = [];
  let dbError = false;

  try {
    const [leadership, people] = await Promise.all([
      getCachedLeadership(),
      getCachedPeople(),
    ]);
    leadershipList = leadership;
    peopleList = people;
  } catch {
    dbError = true;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/leadership"
        description="Manage student officers, terms, seniorities, and normalized person profiles."
        meta={
          !dbError && (
            <>
              <span className={chip('neutral')}>{peopleList.length} profiles</span>
              <span className={chip('accent')}>{leadershipList.length} active terms</span>
            </>
          )
        }
      />

      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <LeadershipManagerClient
          initialLeadership={leadershipList}
          peopleList={peopleList}
        />
      )}
    </AdminPage>
  );
}
