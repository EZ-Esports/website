import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateNewsPost } from '../actions';
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
      .where(eq(schema.newsPosts.id, id))
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
  const inputClass = "w-full px-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all text-sm";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link href="/admin/news" className="text-xs font-bold text-slate-400 hover:text-ez-pink uppercase tracking-widest transition-colors">
          ← Back to News list
        </Link>
      </div>

      <Card className="p-8 space-y-6 hover:shadow-none hover:border-slate-800/80 duration-300">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Edit Announcement</h1>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Modify properties and updates for your published post.</p>
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

          <div className="flex justify-end gap-3 border-t border-slate-900 pt-6">
            <Link
              href="/admin/news"
              className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-ez-pink to-ez-purple text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:brightness-110 shadow-lg shadow-ez-pink/15 transition-all cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
