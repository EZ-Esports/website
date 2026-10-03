import { HiOutlineCurrencyDollar } from 'react-icons/hi2';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { addSponsor } from './actions';
import SponsorRow from '@/app/components/admin/SponsorRow';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import AddEntityForm from '@/app/components/admin/AddEntityForm';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminCount, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection, RequiredMark } from '@/app/components/admin/AdminUI';
import { input, label as labelClass, table, tableWrap, tbody, th, theadRow, thRight } from '@/app/components/admin/styles';

async function getAllSponsors() {
  return db.select().from(schema.sponsors).where(isNull(schema.sponsors.deletedAt)).orderBy(schema.sponsors.tier, schema.sponsors.displayOrder);
}


export default async function SponsorsAdminPage() {
  if (!(await getStaffForAdminSection('/admin/sponsors'))) return <PermissionDenied />;

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
    <AdminPage>
      <AdminPageHeader
        route="/admin/sponsors"
        description="Partners shown on the sponsors page and footer, grouped by tier and sorted by display order."
      />

      {!dbConfigured && <DbErrorNotice />}

      {/* Add Sponsor Form */}
      <AdminSection id="add-sponsor" title="Add a sponsor">
        <AddEntityForm action={addSponsor} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-sponsor-name" className={labelClass}>
              Name <RequiredMark />
            </label>
            <input
              id="add-sponsor-name"
              name="name"
              type="text"
              required
              placeholder="Nike"
              className={input}
            />
          </div>
          <div>
            <ImageUpload section="sponsors" name="logoUrl" storageKeyName="storageKey" label="Logo" />
          </div>
          <div>
            <label htmlFor="add-sponsor-tier" className={labelClass}>Tier</label>
            <select
              id="add-sponsor-tier"
              name="tier"
              defaultValue="community"
              className={input}
            >
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="community">Community</option>
            </select>
          </div>
          <div>
            <label htmlFor="add-sponsor-websiteUrl" className={labelClass}>Website URL</label>
            <input
              id="add-sponsor-websiteUrl"
              name="websiteUrl"
              type="text"
              placeholder="https://sponsor.com"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="add-sponsor-displayOrder" className={labelClass}>Display order</label>
            <input
              id="add-sponsor-displayOrder"
              name="displayOrder"
              type="number"
              defaultValue="0"
              className={input}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end border-t border-line/60 pt-4">
            <SubmitButton label="Add sponsor" pendingLabel="Adding…" />
          </div>
        </AddEntityForm>
      </AdminSection>

      {/* Sponsors Table */}
      <AdminSection variant="flush" title={<>All sponsors<AdminCount>{sponsors.length}</AdminCount></>}>
        {sponsors.length === 0 ? (
          <AdminEmptyState compact icon={<HiOutlineCurrencyDollar />} title="No sponsors yet." description="Add one above." />
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Name</th>
                  <th className={th}>Tier</th>
                  <th className={th}>Website</th>
                  <th className={th}>Status</th>
                  <th className={th}>Order</th>
                  <th className={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {sponsors.map((sponsor) => (
                  <SponsorRow key={sponsor.id} sponsor={sponsor} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
