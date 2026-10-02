import { redirect } from 'next/navigation';
import { getSchoolManagerContext } from '@/app/lib/onboarding/manager-auth';
import {
  getSchoolInvites,
  getPendingSubmissions,
  getSchoolRosters,
  getSchoolPlayerPool,
} from '@/app/lib/onboarding/portal-actions';
import { getCachedGames } from '@/app/lib/db/queries';
import SchoolPortalClient from './SchoolPortalClient';
import PortalShell from '../PortalShell';

interface PortalPageProps {
  searchParams: Promise<{ schoolId?: string; gameId?: string }>;
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { schoolId: paramSchoolId, gameId: paramGameId } = await searchParams;

  const context = await getSchoolManagerContext(paramSchoolId, { allowStaffAdmin: false });
  if (!context) {
    redirect('/portal/login');
  }

  const activeSchool =
    (paramSchoolId && context.managedSchools.find((s) => s.schoolId === paramSchoolId)) ||
    context.managedSchools[0];

  if (!activeSchool) {
    return (
      <PortalShell context={context}>
        <div className="p-8 text-center border border-zinc-800 rounded-xl bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white mb-2">No Managed Schools Assigned</h2>
          <p className="text-sm text-zinc-400">
            Your account is not assigned as a manager for any active schools. Please contact an EZ
            Esports administrator.
          </p>
        </div>
      </PortalShell>
    );
  }

  // Load games from database cache
  const allGames = await getCachedGames();

  // Load initial invites, submissions, rosters, and eligible player pool for the active school
  const [initialInvites, initialSubmissions, initialRosters, initialPlayerPool] = await Promise.all([
    getSchoolInvites(activeSchool.schoolId, paramGameId),
    getPendingSubmissions(activeSchool.schoolId, paramGameId),
    getSchoolRosters(activeSchool.schoolId, paramGameId),
    getSchoolPlayerPool(activeSchool.schoolId, paramGameId),
  ]);

  return (
    <PortalShell context={context}>
      <SchoolPortalClient
        context={context}
        activeSchool={activeSchool}
        games={allGames}
        initialInvites={initialInvites}
        initialSubmissions={initialSubmissions}
        initialRosters={initialRosters}
        initialPlayerPool={initialPlayerPool}
        selectedGameId={paramGameId}
      />
    </PortalShell>
  );
}
