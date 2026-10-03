import { HiOutlineAcademicCap } from 'react-icons/hi2';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { asc, isNull } from 'drizzle-orm';
import { addSchool } from './actions';
import SchoolRow from '@/app/components/admin/SchoolRow';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import AddEntityForm from '@/app/components/admin/AddEntityForm';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { getCachedGames } from '@/app/lib/db/queries';
import { AdminCount, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection, RequiredMark } from '@/app/components/admin/AdminUI';
import { input, label as labelClass, table, tableWrap, tbody, th, theadRow, thRight } from '@/app/components/admin/styles';

async function getAllSchools() {
  return db
    .select()
    .from(schema.schools)
    .where(isNull(schema.schools.deletedAt))
    .orderBy(asc(schema.schools.displayOrder), asc(schema.schools.name));
}

export default async function SchoolsAdminPage() {
  if (!(await getStaffForAdminSection('/admin/schools'))) return <PermissionDenied />;

  let schools: Awaited<ReturnType<typeof getAllSchools>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      [schools, games] = await Promise.all([
        getAllSchools(),
        getCachedGames().catch(() => []),
      ]);
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/schools"
        description="Member schools shown across the public site. Inactive schools stay in the archive but drop off current listings."
      />

      {!dbConfigured && <DbErrorNotice />}

      {/* Add School Form */}
      <AdminSection id="add-school" title="Add a school">
        <AddEntityForm action={addSchool} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-school-name" className={labelClass}>
              Name <RequiredMark />
            </label>
            <input
              id="add-school-name"
              name="name"
              type="text"
              required
              placeholder="Northeastern University"
              className={input}
            />
          </div>
          <div>
            <ImageUpload section="schools" name="logoUrl" storageKeyName="storageKey" label="Logo" />
          </div>
          <div>
            <label htmlFor="add-school-websiteUrl" className={labelClass}>Website URL</label>
            <input
              id="add-school-websiteUrl"
              name="websiteUrl"
              type="text"
              placeholder="https://northeastern.edu"
              className={input}
            />
          </div>
          <input type="hidden" name="displayOrder" value="0" />
          <div className="sm:col-span-2 flex justify-end border-t border-line/60 pt-4">
            <SubmitButton label="Add school" pendingLabel="Adding…" />
          </div>
        </AddEntityForm>
      </AdminSection>

      {/* Schools Table */}
      <AdminSection variant="flush" title={<>All schools<AdminCount>{schools.length}</AdminCount></>}>
        {schools.length === 0 ? (
          <AdminEmptyState compact icon={<HiOutlineAcademicCap />} title="No schools yet." description="Add one above." />
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Name</th>
                  <th className={th}>Website</th>
                  <th className={th}>Status</th>
                  <th className={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {schools.map((school) => (
                  <SchoolRow key={school.id} school={school} games={games} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
