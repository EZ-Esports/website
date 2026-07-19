import { getStaff, StaffSetupError, type StaffIdentity } from '@/app/lib/auth';
import { getAllowedAdminHrefs } from '@/app/lib/staff-access';
import AdminShell from './AdminShell';
import { redirect } from 'next/navigation';
import StaffSetupProblem from '@/app/components/admin/StaffSetupProblem';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Sole browser access gate for the staff portal. Authentication decides whether
 * to redirect; roles only shape the available portal capabilities.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  let staff: StaffIdentity | null;
  try {
    staff = await getStaff();
  } catch (error) {
    if (error instanceof StaffSetupError) {
      return <StaffSetupProblem message={error.message} />;
    }
    throw error;
  }

  if (!staff) {
    redirect('/login');
  }

  const allowedHrefs = getAllowedAdminHrefs(staff.permissions, staff.isOwner);

  return <AdminShell allowedHrefs={allowedHrefs}>{children}</AdminShell>;
}
