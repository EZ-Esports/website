import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { updateNewsPost, unpublishNewsPost } from '../actions';
import NewsPostForm from '@/app/components/admin/NewsPostForm';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { HiArrowTopRightOnSquare } from 'react-icons/hi2';
import { AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';
import NewsStatusBadge from '@/app/components/admin/NewsStatusBadge';
import SubmitButton from '@/app/components/admin/SubmitButton';
import { ghostBtn } from '@/app/components/admin/styles';

interface EditNewsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditNewsPostPage({ params }: EditNewsPageProps) {
  if (!(await getStaffForAdminSection('/admin/news'))) return <PermissionDenied />;

  const { id } = await params;
  
  let currentPost;
  try {
    const posts = await db
      .select()
      .from(schema.newsPosts)
      .where(and(eq(schema.newsPosts.id, id), isNull(schema.newsPosts.deletedAt)))
      .limit(1);
    currentPost = posts[0];
  } catch {
    notFound();
  }

  if (!currentPost) {
    notFound();
  }

  const updateNewsPostWithId = updateNewsPost.bind(null, id);
  const unpublishNewsPostWithId = unpublishNewsPost.bind(null, id);

  return (
    <AdminPage className="mx-auto max-w-3xl">
      <AdminPageHeader
        back={{ href: '/admin/news', label: 'News & Announcements' }}
        route={`/admin/news/${id}`}
        description="Modify properties and updates for your post."
        meta={<NewsStatusBadge status={currentPost.status} />}
        actions={
          currentPost.status === 'published' && (
            <>
              <a href={`/news/${id}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                View live
                <HiArrowTopRightOnSquare aria-hidden className="h-4 w-4" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {/* Separate unpublish form for published posts, outside the edit form */}
              <form action={unpublishNewsPostWithId}>
                <SubmitButton label="Unpublish post" pendingLabel="Unpublishing…" tone="secondary" />
              </form>
            </>
          )
        }
      />

      <AdminSection>
        <NewsPostForm
          action={updateNewsPostWithId}
          status={currentPost.status}
          defaults={{
            title: currentPost.title,
            category: currentPost.category,
            excerpt: currentPost.excerpt ?? '',
            content: currentPost.content,
          }}
        />
      </AdminSection>
    </AdminPage>
  );
}
