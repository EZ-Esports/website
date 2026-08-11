import { getCachedLeadership, getCachedMembers, getCachedSchools } from '@/app/lib/db/queries';
import { createLeader } from './actions';
import Card from '@/app/components/ui/Card';
import LeadershipRow from '@/app/components/admin/LeadershipRow';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import AddEntityForm from '@/app/components/admin/AddEntityForm';
import SubmitButton from '@/app/components/admin/SubmitButton';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';

export default async function AdminLeadershipPage() {
  if (!(await getStaffForAdminSection('/admin/leadership'))) return <PermissionDenied />;

  let leadershipList: Awaited<ReturnType<typeof getCachedLeadership>> = [];
  let membersList: Awaited<ReturnType<typeof getCachedMembers>> = [];
  let schoolsList: Awaited<ReturnType<typeof getCachedSchools>> = [];
  let dbError = false;

  try {
    const [leadership, members, schools] = await Promise.all([
      getCachedLeadership(),
      getCachedMembers(),
      getCachedSchools(),
    ]);
    leadershipList = leadership;
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

  const schoolMap = new Map(schoolsList.map((s) => [s.id, s.name]));

  const inputClass = "w-full px-3.5 py-2.5 bg-surface-sunken border border-line/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all text-sm";

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="border-l-4 border-l-accent hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Leadership Manager</h1>
        <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">
          Manage the student officers, roles, and bios displayed on the public leadership pages.
        </p>
      </Card>

      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Add Leader Column */}
          <Card className="lg:col-span-1 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Add Officer</h2>
              <p className="text-foreground-secondary text-xs mt-1 leading-relaxed">Register a new officer for a specific year.</p>
            </div>

            <AddEntityForm action={createLeader} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  Officer Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Alice Williams"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="handle" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  Handle / IGN (Optional)
                </label>
                <input
                  id="handle"
                  name="handle"
                  type="text"
                  placeholder="e.g. eddyson."
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  Role Title
                </label>
                <input
                  id="role"
                  name="role"
                  type="text"
                  required
                  placeholder="e.g. President"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="year" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  Academic Year
                </label>
                <input
                  id="year"
                  name="year"
                  type="text"
                  required
                  pattern="[0-9]{4}"
                  title="Four-digit year, e.g. 2026"
                  placeholder="e.g. 2026"
                  defaultValue={new Date().getFullYear().toString()}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="highSchool" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  High School (Optional)
                </label>
                <input
                  id="highSchool"
                  name="highSchool"
                  type="text"
                  placeholder="e.g. Stuyvesant High School"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="university" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  University (Optional - Takes Priority)
                </label>
                <input
                  id="university"
                  name="university"
                  type="text"
                  placeholder="e.g. NYU / Columbia"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="memberId" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                  Associated Member
                </label>
                <select
                  id="memberId"
                  name="memberId"
                  className={inputClass}
                  defaultValue=""
                >
                  <option value="">-- Select Member (Optional) --</option>
                  {sortedMembers.map((m) => {
                    const schoolName = schoolMap.get(m.schoolId) || 'Unknown School';
                    const gradSuffix = m.graduationYear ? ` '${m.graduationYear.toString().slice(-2)}` : '';
                    return (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({schoolName}{gradSuffix})
                      </option>
                    );
                  })}
                </select>
              </div>

              <SubmitButton
                label="Add Officer"
                pendingLabel="Adding…"
                className="w-full py-3 bg-white hover:bg-foreground text-surface-sunken text-sm font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </AddEntityForm>
          </Card>

          {/* Officers List Column */}
          <div className="lg:col-span-2 bg-surface-raised/30 border border-line/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {leadershipList.length === 0 ? (
              <div className="p-16 text-center text-foreground-muted text-sm bg-surface-sunken/20 rounded-2xl">
                No leadership members found. Add officers using the left form panel!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0b101d] border-b border-accent/20">
                    <tr className="text-foreground-secondary text-xs font-bold uppercase tracking-widest">
                      <th className="px-6 py-4">Name / High School</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Year</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-sm">
                    {leadershipList.map((leader) => (
                      <LeadershipRow key={leader.id} leader={leader} members={sortedMembers} schools={schoolsList} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
