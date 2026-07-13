import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { addSponsor } from './actions';
import SponsorRow from '@/app/components/admin/SponsorRow';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import AddEntityForm from '@/app/components/admin/AddEntityForm';

async function getAllSponsors() {
  return db.select().from(schema.sponsors).where(isNull(schema.sponsors.deletedAt)).orderBy(schema.sponsors.tier, schema.sponsors.displayOrder);
}


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
      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">Add Sponsor</h2>
        <AddEntityForm action={addSponsor} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
              Name <span className="text-accent">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Nike"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div>
            <ImageUpload name="logoUrl" storageKeyName="storageKey" label="Logo" />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Tier</label>
            <select
              name="tier"
              defaultValue="community"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            >
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="community">Community</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Website URL</label>
            <input
              name="websiteUrl"
              type="text"
              placeholder="https://sponsor.com"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Display Order</label>
            <input
              name="displayOrder"
              type="number"
              defaultValue="0"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton
              label="Add Sponsor"
              pendingLabel="Adding…"
              className="px-6 py-2.5 bg-accent text-on-accent rounded-lg font-bold text-sm hover:bg-accent/80 transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </AddEntityForm>
      </Card>

      {!dbConfigured && <DbErrorNotice />}

      {/* Sponsors Table */}
      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">
          All Sponsors ({sponsors.length})
        </h2>
        {sponsors.length === 0 ? (
          <p className="text-foreground-muted text-sm">No sponsors yet. Add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Name</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Tier</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Website</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">Order</th>
                  <th className="text-right text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {sponsors.map((sponsor) => (
                  <SponsorRow key={sponsor.id} sponsor={sponsor} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
