import {
  getCachedLeadership,
  getCachedPeople,
  getCachedMembers,
  getCachedSchools,
} from '@/app/lib/db/queries';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import LeadershipManagerClient from '@/app/components/admin/LeadershipManagerClient';
import { getStaffForAdminSection } from '@/app/lib/auth';

export default async function AdminLeadershipPage() {
  if (!(await getStaffForAdminSection('/admin/leadership'))) return <PermissionDenied />;

  let leadershipList: Awaited<ReturnType<typeof getCachedLeadership>> = [];
  let peopleList: Awaited<ReturnType<typeof getCachedPeople>> = [];
  let membersList: Awaited<ReturnType<typeof getCachedMembers>> = [];
  let schoolsList: Awaited<ReturnType<typeof getCachedSchools>> = [];
  let dbError = false;

  try {
    const [leadership, people, members, schools] = await Promise.all([
      getCachedLeadership(),
      getCachedPeople(),
      getCachedMembers(),
      getCachedSchools(),
    ]);
    leadershipList = leadership;
    peopleList = people;
    membersList = members;
    schoolsList = schools;
  } catch {
    dbError = true;
  }

  // Sort members by last name then first name
  const sortedMembers = [...membersList].sort((a, b) => {
    const nameA = `${a.lastName || ''}, ${a.firstName || ''}`.toLowerCase();
    const nameB = `${b.lastName || ''}, ${b.firstName || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-8">
      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <LeadershipManagerClient
          initialLeadership={leadershipList}
          peopleList={peopleList}
          membersList={sortedMembers}
          schoolsList={schoolsList}
        />
      )}
    </div>
  );
}
