import { getStaffForAdminSection } from '@/app/lib/auth';
import { getAllCareerPostingsAdmin } from '@/app/lib/db/queries';
import CareersManagerClient from '@/app/components/admin/CareersManagerClient';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import type { AdminCareerPostingWithStats } from '@/app/types/careers';

export const metadata = {
  title: 'Careers Management | EZ Staff',
};

export default async function CareersAdminPage() {
  if (!(await getStaffForAdminSection('/admin/careers'))) {
    return <PermissionDenied />;
  }

  let postings: AdminCareerPostingWithStats[] = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
      postings = await getAllCareerPostingsAdmin();
      dbConfigured = true;
    }
  } catch (error) {
    console.error('Failed to load career postings for admin', error);
  }

  return (
    <div className="space-y-6">
      {!dbConfigured && <DbErrorNotice />}
      <CareersManagerClient initialPostings={postings} />
    </div>
  );
}
