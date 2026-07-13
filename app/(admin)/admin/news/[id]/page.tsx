import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateNewsPost, unpublishNewsPost } from '../actions';
import Card from '@/app/components/ui/Card';
import NewsPostForm from '@/app/components/admin/NewsPostForm';

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

  const updateNewsPostWithId = updateNewsPost.bind(null, id);
  const unpublishNewsPostWithId = unpublishNewsPost.bind(null, id);

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
      <span className="inline-block px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-line text-foreground-muted border border-line">
        Archived
      </span>
    );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link href="/admin/news" className="text-xs font-bold text-foreground-secondary hover:text-accent uppercase tracking-widest transition-colors">
          ← Back to News list
        </Link>
      </div>

      <Card className="p-8 space-y-6 hover:shadow-none hover:border-line/80 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Edit Announcement</h1>
            <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">Modify properties and updates for your post.</p>
          </div>
          <div className="shrink-0 mt-1">{statusBadge}</div>
        </div>

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
