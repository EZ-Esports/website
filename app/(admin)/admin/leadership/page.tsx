import { getCachedLeadership } from '@/app/lib/db/queries';
import { createLeader } from './actions';
import Card from '@/app/components/ui/Card';
import LeadershipRow from '@/app/components/admin/LeadershipRow';

export default async function AdminLeadershipPage() {
  let leadershipList: Awaited<ReturnType<typeof getCachedLeadership>> = [];
  let dbError = false;

  try {
    leadershipList = await getCachedLeadership();
  } catch {
    dbError = true;
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all text-sm";

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Leadership Manager</h1>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Manage the student officers, roles, and bios displayed on the public leadership pages.
        </p>
      </Card>

      {dbError && (
        <div className="bg-ez-pink/10 border border-ez-pink/20 text-ez-pink/80 text-sm px-4 py-3 rounded-lg">
          Failed to fetch leadership data. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Add Leader Column */}
          <Card className="lg:col-span-1 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Add Officer</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">Register a new officer for a specific year.</p>
            </div>

            <form action={createLeader} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
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
                <label htmlFor="role" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
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
                <label htmlFor="year" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
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
                <label htmlFor="bio" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Short Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  placeholder="e.g. Leading student initiatives and community events..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all text-sm leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-white hover:bg-slate-200 text-slate-950 text-sm font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Add Officer
              </button>
            </form>
          </Card>

          {/* Officers List Column */}
          <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {leadershipList.length === 0 ? (
              <div className="p-16 text-center text-slate-500 text-sm bg-slate-950/20 rounded-2xl">
                No leadership members found. Add officers using the left form panel!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0b101d] border-b border-slate-800/80">
                    <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                      <th className="px-6 py-4">Name / Bio</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Year</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {leadershipList.map((leader) => (
                      <LeadershipRow key={leader.id} leader={leader} />
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
