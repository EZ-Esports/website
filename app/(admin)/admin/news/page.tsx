import { getCachedNews } from '@/app/lib/db/queries';
import Link from 'next/link';
import { deleteNewsPost } from './actions';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

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
      <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-800/80 hover:shadow-none duration-300">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">News & Announcements</h1>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Write articles, publish announcements, and edit blog posts displayed on the homepage.
          </p>
        </div>
        <Link href="/admin/news/new" className="shrink-0">
          <Button variant="primary">+ Write Article</Button>
        </Link>
      </Card>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch articles. Please make sure migrations have run.
        </div>
      )}

      {/* Articles Table */}
      {!dbError && (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
          {posts.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm bg-slate-950/20 rounded-2xl">
              No news articles found. Click &ldquo;+ Write Article&rdquo; to create your first announcement!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#0b101d] border-b border-slate-800/80">
                  <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Published Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {posts.map((post) => {
                    const deleteActionWithId = deleteNewsPost.bind(null, post.id);
                    return (
                      <tr key={post.id} className="hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white text-base tracking-tight">{post.title}</div>
                          <div className="text-xs text-slate-400 max-w-md truncate mt-1 leading-relaxed">
                            {post.excerpt || 'No excerpt provided.'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-ez-pink/15 text-ez-pink border border-ez-pink/25">
                            {post.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-medium">
                          {new Date(post.publishedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Link
                              href={`/admin/news/${post.id}`}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                            >
                              Edit
                            </Link>
                            <form action={deleteActionWithId} className="inline-block">
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-ez-pink/10 hover:bg-ez-pink/20 font-bold text-xs uppercase tracking-wider rounded-lg text-ez-pink border border-ez-pink/25 hover:border-ez-pink/40 transition-all cursor-pointer"
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
