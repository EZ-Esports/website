import { redirect } from 'next/navigation';
import { getSchoolManagerContext } from '@/app/lib/onboarding/manager-auth';
import {
  getSchoolInvites,
  getPendingSubmissions,
  getSchoolRosters,
} from '@/app/lib/onboarding/portal-actions';
import { getCachedGames } from '@/app/lib/db/queries';
import SchoolPortalClient from './SchoolPortalClient';

interface PortalPageProps {
  searchParams: Promise<{ schoolId?: string; gameId?: string }>;
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { schoolId: paramSchoolId, gameId: paramGameId } = await searchParams;

  const context = await getSchoolManagerContext(paramSchoolId);
  if (!context) {
    redirect('/login');
  }

  const activeSchool =
    (paramSchoolId && context.managedSchools.find((s) => s.schoolId === paramSchoolId)) ||
    context.managedSchools[0];

  if (!activeSchool) {
    return (
      <div className="p-8 text-center border border-zinc-800 rounded-xl bg-zinc-900/50">
        <h2 className="text-xl font-bold text-white mb-2">No Managed Schools Assigned</h2>
        <p className="text-sm text-zinc-400">
          Your account is not assigned as a manager for any active schools. Please contact an EZ
          Esports administrator.
        </p>
      </div>
    );
  }

  // Load games from database cache
  const allGames = await getCachedGames();

  // Load initial invites, submissions, and rosters for the active school
  const [initialInvites, initialSubmissions, initialRosters] = await Promise.all([
    getSchoolInvites(activeSchool.schoolId, paramGameId),
    getPendingSubmissions(activeSchool.schoolId, paramGameId),
    getSchoolRosters(activeSchool.schoolId, paramGameId),
  ]);

  return (
    <SchoolPortalClient
      context={context}
      activeSchool={activeSchool}
      games={allGames}
      initialInvites={initialInvites}
      initialSubmissions={initialSubmissions}
      initialRosters={initialRosters}
      selectedGameId={paramGameId}
    />
  );
}
