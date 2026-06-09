import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateNewsPost, unpublishNewsPost } from '../actions';
import Card from '@/app/components/ui/Card';

interface EditNewsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditNewsPostPage({ params }: EditNewsPageProps) {
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

  const categories = ['Announcement', 'Tournament', 'Partnership', 'Recognition', 'Update'];
  const updateNewsPostWithId = updateNewsPost.bind(null, id);
  const unpublishNewsPostWithId = unpublishNewsPost.bind(null, id);
  const inputClass = "w-full px-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all text-sm";

  const statusBadge =
    currentPost.status === 'published' ? (
      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-green-500/10 text-green-400 border border-green-500/20">
        Published
      </span>
    ) : currentPost.status === 'draft' ? (
      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        Draft
      </span>
    ) : (
      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
        Archived
      </span>
    );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link href="/admin/news" className="text-xs font-bold text-slate-400 hover:text-ez-pink uppercase tracking-widest transition-colors">
          ← Back to News list
        </Link>
      </div>

      <Card className="p-8 space-y-6 hover:shadow-none hover:border-slate-800/80 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Edit Announcement</h1>
            <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Modify properties and updates for your post.</p>
          </div>
          <div className="shrink-0 mt-1">{statusBadge}</div>
        </div>

        <form action={updateNewsPostWithId} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Article Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={currentPost.title}
                placeholder="e.g. Spring 2025 Playoffs Schedule"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                defaultValue={currentPost.category}
                className={`${inputClass} cursor-pointer`}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="excerpt" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Excerpt / Short Summary
              </label>
              <input
                id="excerpt"
                name="excerpt"
                type="text"
                defaultValue={currentPost.excerpt || ''}
                placeholder="e.g. A brief overview displayed in lists..."
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="content" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Content Body
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={12}
                defaultValue={currentPost.content}
                placeholder="Write your article content here..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all font-mono text-sm leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-900 pt-6 flex-wrap">
            <Link
              href="/admin/news"
              className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </Link>
            {currentPost.status === 'draft' && (
              <>
                <button
                  type="submit"
                  name="intent"
                  value="draft"
                  className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="publish"
                  className="px-5 py-2.5 bg-ez-pink text-ez-black hover:bg-ez-pink/80 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  Publish
                </button>
              </>
            )}
            {currentPost.status === 'published' && (
              <button
                type="submit"
                name="intent"
                value="publish"
                className="px-5 py-2.5 bg-ez-pink text-ez-black hover:bg-ez-pink/80 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Save & Keep Published
              </button>
            )}
            {currentPost.status === 'archived' && (
              <button
                type="submit"
                name="intent"
                value="draft"
                className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                Save as Draft
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* Separate unpublish form for published posts — outside the edit form */}
      {currentPost.status === 'published' && (
        <div className="flex justify-end">
          <form action={unpublishNewsPostWithId}>
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-900/20 hover:bg-yellow-900/40 font-bold text-xs uppercase tracking-wider rounded-lg text-yellow-400 border border-yellow-800/30 hover:border-yellow-700/50 transition-all cursor-pointer"
            >
              Unpublish Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
