import { createNewsPost } from '../actions';
import NewsPostForm from '@/app/components/admin/NewsPostForm';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';

export default async function AdminNewNewsPostPage() {
  if (!(await getStaffForAdminSection('/admin/news'))) return <PermissionDenied />;

  return (
    <AdminPage className="mx-auto max-w-3xl">
      <AdminPageHeader
        back={{ href: '/admin/news', label: 'News & Announcements' }}
        route="/admin/news/new"
        description="Publish news updates to the public league portal."
      />

      <AdminSection>
        <NewsPostForm action={createNewsPost} status="new" />
      </AdminSection>
    </AdminPage>
  );
}
