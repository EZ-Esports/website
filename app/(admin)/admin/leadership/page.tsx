import { getCachedLeadership } from '@/app/lib/db/queries';
import { createLeader, deleteLeader } from './actions';
import Card from '@/app/components/ui/Card';

export default async function AdminLeadershipPage() {
  let leadershipList: any[] = [];
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
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
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
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {leadershipList.map((leader) => {
                      const deleteActionWithId = deleteLeader.bind(null, leader.id, leader.year);

                      return (
                        <tr key={leader.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-base tracking-tight">{leader.name}</div>
                            <div className="text-xs text-slate-400 max-w-xs truncate mt-1 leading-relaxed">
                              {leader.bio || 'No bio provided.'}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-200">
                            {leader.role}
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-semibold">
                            {leader.year}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <form action={deleteActionWithId}>
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
                              >
                                Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
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
