import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { desc, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { FiEdit2 } from 'react-icons/fi';
import { HiArrowTopRightOnSquare, HiOutlineNewspaper, HiPlus } from 'react-icons/hi2';
import { deleteNewsPost, publishNewsPost, unpublishNewsPost, archiveNewsPost } from './actions';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import SubmitButton from '@/app/components/admin/SubmitButton';
import NewsStatusBadge from '@/app/components/admin/NewsStatusBadge';
import {
  chip,
  editIconBtn,
  ghostBtnSm,
  primaryBtn,
  secondaryBtnSm,
  table,
  tableWrap,
  tbody,
  td,
  tdRight,
  th,
  theadRow,
  thRight,
  tr,
} from '@/app/components/admin/styles';
import {
  AdminCount,
  AdminEmptyState,
  AdminFilterTabs,
  AdminSearchField,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';

type NewsPost = typeof schema.newsPosts.$inferSelect;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  if (!(await getStaffForAdminSection('/admin/news'))) return <PermissionDenied />;

  const { q = '', status = '' } = await searchParams;
  let posts: NewsPost[] = [];
  let dbError = false;

  try {
    posts = await db
      .select()
      .from(schema.newsPosts)
      .where(isNull(schema.newsPosts.deletedAt))
      .orderBy(desc(schema.newsPosts.createdAt));
  } catch {
    dbError = true;
  }

  // Filter by status tab
  const statusFiltered =
    status && ['draft', 'published', 'archived'].includes(status)
      ? posts.filter((p) => p.status === status)
      : posts;

  // Filter by search query
  const filtered = q
    ? statusFiltered.filter(
        (p) =>
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          p.category.toLowerCase().includes(q.toLowerCase())
      )
    : statusFiltered;

  const counts = {
    all: posts.length,
    draft: posts.filter((p) => p.status === 'draft').length,
    published: posts.filter((p) => p.status === 'published').length,
    archived: posts.filter((p) => p.status === 'archived').length,
  };

  const tabs = [
    { label: 'All', value: '', count: counts.all },
    { label: 'Draft', value: 'draft', count: counts.draft },
    { label: 'Published', value: 'published', count: counts.published },
    { label: 'Archived', value: 'archived', count: counts.archived },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/news"
        description="Write articles, publish announcements, and edit blog posts displayed on the homepage."
        actions={
          <Link href="/admin/news/new" className={primaryBtn}>
            <HiPlus aria-hidden className="h-4 w-4" />
            Write article
          </Link>
        }
      />

      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <AdminSection
          variant="flush"
          stickyToolbar
          title={
            <>
              Articles
              <AdminCount>{q || status ? `${filtered.length} of ${posts.length}` : posts.length}</AdminCount>
            </>
          }
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Status filter tabs */}
              <AdminFilterTabs
                label="Filter articles by status"
                items={tabs.map((tab) => ({
                  key: tab.value || 'all',
                  label: tab.label,
                  count: tab.count,
                  href: tab.value
                    ? `/admin/news?${q ? `q=${encodeURIComponent(q)}&` : ''}status=${tab.value}`
                    : `/admin/news${q ? `?q=${encodeURIComponent(q)}` : ''}`,
                  active: status === tab.value,
                }))}
              />

              {/* Search form */}
              <form method="GET" role="search" className="flex w-full items-center gap-2 sm:w-auto">
                {status && <input type="hidden" name="status" value={status} />}
                <AdminSearchField
                  size="sm"
                  className="w-full sm:w-64"
                  name="q"
                  defaultValue={q}
                  aria-label="Search articles"
                  placeholder="Search by title or category…"
                />
                <button type="submit" className={secondaryBtnSm}>
                  Search
                </button>
                {q && (
                  <a href={status ? `/admin/news?status=${status}` : '/admin/news'} className={ghostBtnSm}>
                    Clear
                  </a>
                )}
              </form>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <AdminEmptyState
              icon={<HiOutlineNewspaper />}
              title={q ? `No articles match "${q}".` : 'No news articles found.'}
              description={q ? 'Try a different search, or clear it to see every article.' : 'Write your first announcement to get started.'}
              action={
                !q && (
                  <Link href="/admin/news/new" className={primaryBtn}>
                    <HiPlus aria-hidden className="h-4 w-4" />
                    Write article
                  </Link>
                )
              }
            />
          ) : (
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr className={theadRow}>
                    <th className={th}>Title</th>
                    <th className={th}>Category</th>
                    <th className={th}>Status</th>
                    <th className={th}>Published</th>
                    <th className={thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tbody}>
                  {filtered.map((post) => {
                    const deleteActionWithId = deleteNewsPost.bind(null, post.id);
                    const publishActionWithId = publishNewsPost.bind(null, post.id);
                    const unpublishActionWithId = unpublishNewsPost.bind(null, post.id);
                    const archiveActionWithId = archiveNewsPost.bind(null, post.id);

                    return (
                      <tr key={post.id} className={tr}>
                        <td className={td}>
                          <Link
                            href={`/admin/news/${post.id}`}
                            className="rounded font-medium text-foreground underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          >
                            {post.title}
                          </Link>
                          <div className="mt-0.5 max-w-md truncate text-xs text-foreground-secondary">
                            {post.excerpt || 'No excerpt provided.'}
                          </div>
                        </td>
                        <td className={td}>
                          <span className={chip('neutral')}>{post.category}</span>
                        </td>
                        <td className={td}>
                          <NewsStatusBadge status={post.status} />
                        </td>
                        <td className={cx(td, 'whitespace-nowrap text-foreground-secondary')}>
                          {post.publishedAt ? (
                            new Date(post.publishedAt).toLocaleDateString('en-US', {
                              timeZone: 'America/New_York',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          ) : (
                            <span className="text-foreground-secondary">Not published</span>
                          )}
                        </td>
                        <td className={tdRight}>
                          <div className="flex flex-nowrap items-center justify-end gap-2">
                            {post.status === 'draft' && (
                              <form action={publishActionWithId}>
                                <SubmitButton label="Publish" pendingLabel="Publishing…" tone="secondary" size="sm" />
                              </form>
                            )}
                            {post.status === 'published' && (
                              <>
                                <form action={unpublishActionWithId}>
                                  <SubmitButton label="Unpublish" pendingLabel="Unpublishing…" tone="ghost" size="sm" />
                                </form>
                                <form action={archiveActionWithId}>
                                  <SubmitButton label="Archive" pendingLabel="Archiving…" tone="ghost" size="sm" />
                                </form>
                                <a
                                  href={`/news/${post.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={ghostBtnSm}
                                >
                                  View live
                                  <HiArrowTopRightOnSquare aria-hidden className="h-3.5 w-3.5" />
                                  <span className="sr-only"> (opens in a new tab)</span>
                                </a>
                              </>
                            )}
                            {post.status === 'archived' && (
                              <form action={unpublishActionWithId}>
                                <SubmitButton label="Restore" pendingLabel="Restoring…" tone="ghost" size="sm" />
                              </form>
                            )}
                            <Link
                              href={`/admin/news/${post.id}`}
                              aria-label={`Edit article ${post.title}`}
                              title={`Edit article ${post.title}`}
                              className={editIconBtn}
                            >
                              <FiEdit2 aria-hidden="true" className="h-4 w-4" />
                            </Link>
                            <ConfirmDeleteButton
                              action={deleteActionWithId}
                              message={`Delete "${post.title}"? This permanently removes the article from the public site.`}
                              label={`Delete article ${post.title}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminSection>
      )}
    </AdminPage>
  );
}
