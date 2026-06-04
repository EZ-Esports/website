import { getCachedNews } from '@/app/lib/db/queries';
import Link from 'next/link';
import { deleteNewsPost } from './actions';

export default async function AdminNewsPage() {
  let posts: Awaited<ReturnType<typeof getCachedNews>> = [];
  let dbError = false;

  try {
    posts = await getCachedNews();
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div>
          <h1 className="text-2xl font-bold text-white">News & Announcements</h1>
          <p className="text-gray-400 text-xs mt-1">Write articles, publish updates, and edit blog posts on the main site.</p>
        </div>
        <Link
          href="/admin/news/new"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
        >
          + Write Article
        </Link>
      </div>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch articles. Please make sure migrations have run.
        </div>
      )}

      {/* Articles Table */}
      {!dbError && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {posts.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No news articles found. Click &ldquo;+ Write Article&rdquo; to create your first announcement!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Published Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {posts.map((post) => {
                    const deleteActionWithId = deleteNewsPost.bind(null, post.id);
                    return (
                      <tr key={post.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{post.title}</div>
                          <div className="text-xs text-gray-400 max-w-md truncate mt-0.5">{post.excerpt || 'No excerpt provided.'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded">
                            {post.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {new Date(post.publishedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <Link
                              href={`/admin/news/${post.id}`}
                              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 font-semibold text-xs rounded transition-colors text-gray-300"
                            >
                              Edit
                            </Link>
                            <form action={deleteActionWithId}>
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 font-semibold text-xs rounded transition-colors text-rose-400 border border-rose-950/30 cursor-pointer"
                              >
                                Delete
                              </button>
                            </form>
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
      )}
    </div>
  );
}
