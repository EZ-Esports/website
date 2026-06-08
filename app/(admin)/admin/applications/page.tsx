import Card from '@/app/components/ui/Card';
import { getSchoolApplications } from '@/app/lib/db/queries';

const statusBadgeClass: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400',
  reviewed: 'bg-blue-500/10 text-blue-400',
  accepted: 'bg-green-500/10 text-green-400',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
};

export default async function ApplicationsAdminPage() {
  let applications: Awaited<ReturnType<typeof getSchoolApplications>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      applications = await getSchoolApplications();
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  return (
    <div className="space-y-8">
      {!dbConfigured && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl mt-0.5 select-none animate-pulse">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-amber-400 tracking-tight">Database Not Configured</h3>
              <p className="text-slate-300 text-sm leading-relaxed mt-1">
                Set <code>DATABASE_URL</code> in your <code>.env</code> file and run <code>npm run db:push</code> to view applications.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-slate-900/30 border border-slate-800">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">
            School Applications
            {dbConfigured && (
              <span className="ml-2 text-slate-400 font-normal text-sm">({applications.length})</span>
            )}
          </h2>
        </div>

        {applications.length === 0 ? (
          <p className="text-slate-500 text-sm">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Applicant</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">School</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Role</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Email</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Message</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{app.applicantName}</td>
                    <td className="py-3 pr-4 text-slate-300">{app.schoolName}</td>
                    <td className="py-3 pr-4 text-slate-300 capitalize">{app.role}</td>
                    <td className="py-3 pr-4">
                      <a
                        href={`mailto:${app.email}`}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {app.email}
                      </a>
                    </td>
                    <td className="py-3 pr-4 text-slate-400 max-w-[200px]">
                      {app.message
                        ? app.message.length > 60
                          ? `${app.message.slice(0, 60)}…`
                          : app.message
                        : <span className="text-zinc-600 italic">—</span>
                      }
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusBadgeClass[app.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                        {statusLabel[app.status] ?? app.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(app.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
