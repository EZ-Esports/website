import { getAdmin, isSuperAdmin } from '@/app/lib/auth';
import AdminShell from './AdminShell';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Server wrapper for the admin panel chrome. Resolves the current admin's role
 * (getAdmin is React.cache'd, so this reuses the (admin) group layout's lookup)
 * and tells the client shell whether to surface team-management UI — only
 * super_admins manage the allowlist; plain admins manage content only.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const admin = await getAdmin();
  const canManageTeam = admin ? isSuperAdmin(admin.role) : false;

  return <AdminShell canManageTeam={canManageTeam}>{children}</AdminShell>;
}
