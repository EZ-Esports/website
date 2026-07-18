import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { desc, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { deleteNewsPost, publishNewsPost, unpublishNewsPost, archiveNewsPost } from './actions';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';

type NewsPost = typeof schema.newsPosts.$inferSelect;

function StatusBadge({ status }: { status: NewsPost['status'] }) {
  if (status === 'published') {
    return (
      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-green-500/10 text-green-400 border border-green-500/20">
        Published
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        Draft
      </span>
    );
  }
  return (
    <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-line text-foreground-muted border border-line">
      Archived
    </span>
  );
}

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
    <div className="space-y-6">
      {/* Header Panel */}
      <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-l-4 border-l-accent hover:shadow-none duration-300">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">News & Announcements</h1>
          <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">
            Write articles, publish announcements, and edit blog posts displayed on the homepage.
          </p>
        </div>
        <Link href="/admin/news/new" className="shrink-0">
          <Button variant="primary">+ Write Article</Button>
        </Link>
      </Card>

      {dbError && <DbErrorNotice variant="error" />}

      {!dbError && (
        <div className="space-y-3">
          {/* Status filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {tabs.map((tab) => {
              const href =
                tab.value
                  ? `/admin/news?${q ? `q=${encodeURIComponent(q)}&` : ''}status=${tab.value}`
                  : `/admin/news${q ? `?q=${encodeURIComponent(q)}` : ''}`;
              const isActive = status === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={href}
                  scroll={false}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${
                    isActive
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-surface-raised text-foreground-secondary border-line hover:border-line hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-[10px] opacity-70">{tab.count}</span>
                </Link>
              );
            })}
          </div>

          {/* Search form */}
          <form method="GET" className="flex gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by title or category…"
              className="flex-1 px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-surface-raised hover:bg-line text-foreground border border-line rounded-lg text-sm font-bold transition-all cursor-pointer"
            >
              Search
            </button>
            {q && (
              <a
                href={status ? `/admin/news?status=${status}` : '/admin/news'}
                className="px-4 py-2 bg-surface-raised hover:bg-line text-foreground-secondary border border-line rounded-lg text-sm font-bold transition-all"
              >
                Clear
              </a>
            )}
          </form>

          {(q || status) && (
            <p className="text-xs text-foreground-muted">
              Showing {filtered.length} of {posts.length} articles
            </p>
          )}

          <div className="bg-surface-raised/30 border border-line/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {filtered.length === 0 ? (
              <div className="p-16 text-center text-foreground-muted text-sm bg-surface-sunken/20 rounded-2xl">
                {q
                  ? `No articles match "${q}".`
                  : 'No news articles found. Click "+ Write Article" to create your first announcement!'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0b101d] border-b border-accent/20">
                    <tr className="text-foreground-secondary text-xs font-bold uppercase tracking-widest">
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Published Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-sm">
                    {filtered.map((post) => {
                      const deleteActionWithId = deleteNewsPost.bind(null, post.id);
                      const publishActionWithId = publishNewsPost.bind(null, post.id);
                      const unpublishActionWithId = unpublishNewsPost.bind(null, post.id);
                      const archiveActionWithId = archiveNewsPost.bind(null, post.id);

                      return (
                        <tr key={post.id} className="hover:bg-line/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-base tracking-tight">{post.title}</div>
                            <div className="text-xs text-foreground-secondary max-w-md truncate mt-1 leading-relaxed">
                              {post.excerpt || 'No excerpt provided.'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-surface-raised text-foreground-secondary border border-line">
                              {post.category}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={post.status} />
                          </td>
                          <td className="px-6 py-4 text-foreground-secondary font-medium">
                            {post.publishedAt ? (
                              new Date(post.publishedAt).toLocaleDateString('en-US', {
                                timeZone: 'America/New_York',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            ) : (
                              <span className="text-foreground-muted italic">Not published</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2 flex-wrap">
                              {post.status === 'draft' && (
                                <form action={publishActionWithId}>
                                  <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 font-bold text-xs uppercase tracking-wider rounded-lg text-green-400 border border-green-800/40 hover:border-green-700/60 transition-all cursor-pointer"
                                  >
                                    Publish
                                  </button>
                                </form>
                              )}
                              {post.status === 'published' && (
                                <>
                                  <form action={unpublishActionWithId}>
                                    <button
                                      type="submit"
                                      className="px-3 py-1.5 bg-yellow-900/20 hover:bg-yellow-900/40 font-bold text-xs uppercase tracking-wider rounded-lg text-yellow-400 border border-yellow-800/30 hover:border-yellow-700/50 transition-all cursor-pointer"
                                    >
                                      Unpublish
                                    </button>
                                  </form>
                                  <form action={archiveActionWithId}>
                                    <button
                                      type="submit"
                                      className="px-3 py-1.5 bg-line hover:bg-line/60 font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary border border-line hover:border-foreground-muted transition-all cursor-pointer"
                                    >
                                      Archive
                                    </button>
                                  </form>
                                  <a
                                    href={`/news/${post.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer"
                                  >
                                    View Live ↗
                                  </a>
                                </>
                              )}
                              {post.status === 'archived' && (
                                <form action={unpublishActionWithId}>
                                  <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary border border-line hover:border-line transition-all cursor-pointer"
                                  >
                                    Restore
                                  </button>
                                </form>
                              )}
                              <Link
                                href={`/admin/news/${post.id}`}
                                className="px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer"
                              >
                                Edit
                              </Link>
                              <ConfirmDeleteButton
                                action={deleteActionWithId}
                                message={`Delete "${post.title}"? This permanently removes the article from the public site.`}
                                className="px-3 py-1.5 bg-surface-raised hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer"
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
          </div>
        </div>
      )}
    </div>
  );
}
