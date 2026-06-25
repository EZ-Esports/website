import { getAdmin } from '@/app/lib/auth';
import { hasPermission, Permissions } from '@/app/lib/roles';
import AdminShell from './AdminShell';
import { redirect } from 'next/navigation';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Server wrapper for the admin panel chrome. Resolves the current admin's permissions
 * on the server, filters out forbidden navigation paths, and passes the allowed
 * routes to the client shell.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const admin = await getAdmin();
  if (!admin) {
    redirect('/login');
  }

  const allowedHrefs: string[] = ['/admin'];

  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_LEAGUE)) {
    allowedHrefs.push('/admin/league');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_MATCHES)) {
    allowedHrefs.push('/admin/matches');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_ROSTERS)) {
    allowedHrefs.push('/admin/roster');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_NEWS)) {
    allowedHrefs.push('/admin/news');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_LEADERSHIP)) {
    allowedHrefs.push('/admin/leadership');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_GALLERY)) {
    allowedHrefs.push('/admin/gallery');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_SPONSORS)) {
    allowedHrefs.push('/admin/sponsors');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_SCHOOLS)) {
    allowedHrefs.push('/admin/schools');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_APPLICATIONS)) {
    allowedHrefs.push('/admin/applications');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_CONTENT)) {
    allowedHrefs.push('/admin/content');
  }
  if (hasPermission(admin.permissions, admin.isOwner, Permissions.MANAGE_ROLES)) {
    allowedHrefs.push('/admin/team');
  }

  return <AdminShell allowedHrefs={allowedHrefs}>{children}</AdminShell>;
}
