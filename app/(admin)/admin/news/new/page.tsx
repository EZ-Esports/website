import Link from 'next/link';
import { createNewsPost } from '../actions';

export default function AdminNewNewsPostPage() {
  const categories = ['Announcement', 'Tournament', 'Partnership', 'Recognition', 'Update'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/news" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Back to News list
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Write Announcement</h1>
          <p className="text-gray-400 text-xs mt-1">Publish news updates to the league portal.</p>
        </div>

        <form action={createNewsPost} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-sm font-semibold text-gray-300 mb-1">
                Article Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. Spring 2025 Playoffs Schedule"
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-gray-300 mb-1">
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="excerpt" className="block text-sm font-semibold text-gray-300 mb-1">
                Excerpt / Short Summary
              </label>
              <input
                id="excerpt"
                name="excerpt"
                type="text"
                placeholder="e.g. A brief overview displayed in lists..."
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="content" className="block text-sm font-semibold text-gray-300 mb-1">
                Content Body
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={12}
                placeholder="Write your article content here..."
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all font-mono text-sm leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 border-t border-gray-800 pt-6">
            <Link
              href="/admin/news"
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 font-semibold text-sm rounded-lg transition-colors text-gray-300"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 font-semibold text-sm rounded-lg shadow-lg hover:shadow-rose-600/10 transition-colors cursor-pointer"
            >
              Publish Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
