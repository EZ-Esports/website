import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { addSponsor } from './actions';

async function getAllSponsors() {
  return db.select().from(schema.sponsors).orderBy(schema.sponsors.tier, schema.sponsors.displayOrder);
}

const tierLabel: Record<string, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  community: 'Community',
};

const tierBadgeClass: Record<string, string> = {
  platinum: 'bg-slate-300/10 text-slate-300',
  gold: 'bg-yellow-500/10 text-yellow-400',
  community: 'bg-blue-500/10 text-blue-400',
};

export default async function SponsorsAdminPage() {
  let sponsors: Awaited<ReturnType<typeof getAllSponsors>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      sponsors = await getAllSponsors();
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  return (
    <div className="space-y-8">
      {/* Add Sponsor Form */}
      <Card className="bg-slate-900/30 border border-slate-800">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">Add Sponsor</h2>
        <form action={addSponsor} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Name <span className="text-ez-pink">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Nike"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Logo URL</label>
            <input
              name="logoUrl"
              type="text"
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tier</label>
            <select
              name="tier"
              defaultValue="community"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            >
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="community">Community</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Website URL</label>
            <input
              name="websiteUrl"
              type="text"
              placeholder="https://sponsor.com"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Display Order</label>
            <input
              name="displayOrder"
              type="number"
              defaultValue="0"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-ez-pink text-white rounded-lg font-bold text-sm hover:bg-rose-700 transition-all duration-300 cursor-pointer"
            >
              Add Sponsor
            </button>
          </div>
        </form>
      </Card>

      {!dbConfigured && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl mt-0.5 select-none animate-pulse">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-amber-400 tracking-tight">Database Not Configured</h3>
              <p className="text-slate-300 text-sm leading-relaxed mt-1">
                Set <code>DATABASE_URL</code> in your <code>.env</code> file and run <code>npm run db:push</code> to enable sponsor management.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sponsors Table */}
      <Card className="bg-slate-900/30 border border-slate-800">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">
          All Sponsors ({sponsors.length})
        </h2>
        {sponsors.length === 0 ? (
          <p className="text-slate-500 text-sm">No sponsors yet. Add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Name</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Tier</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Website</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {sponsors.map((sponsor) => (
                  <tr key={sponsor.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-white">{sponsor.name}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierBadgeClass[sponsor.tier] ?? 'bg-zinc-800 text-zinc-400'}`}>
                        {tierLabel[sponsor.tier] ?? sponsor.tier}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {sponsor.websiteUrl ? (
                        <a
                          href={sponsor.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-white transition-colors truncate max-w-[180px] block"
                        >
                          {sponsor.websiteUrl}
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sponsor.isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                        {sponsor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{sponsor.displayOrder}</td>
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
