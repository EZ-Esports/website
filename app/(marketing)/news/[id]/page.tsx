import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';
import Markdown from '@/app/components/ui/Markdown';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

interface NewsArticlePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: NewsArticlePageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const post = await db
      .select()
      .from(schema.newsPosts)
      .where(
        and(
          eq(schema.newsPosts.id, id),
          eq(schema.newsPosts.status, 'published'),
          isNull(schema.newsPosts.deletedAt)
        )
      )
      .limit(1);
    if (!post[0]) return { title: 'Article Not Found | EZ Esports' };
    return {
      title: `${post[0].title} | EZ Esports`,
      description: post[0].excerpt || `Read more about ${post[0].title} on EZ Esports.`,
    };
  } catch {
    return { title: 'News | EZ Esports' };
  }
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { id } = await params;

  let post: typeof schema.newsPosts.$inferSelect | null = null;
  try {
    const rows = await db
      .select()
      .from(schema.newsPosts)
      .where(
        and(
          eq(schema.newsPosts.id, id),
          eq(schema.newsPosts.status, 'published'),
          isNull(schema.newsPosts.deletedAt)
        )
      )
      .limit(1);
    post = rows[0] ?? null;
  } catch (error) {
    console.error('Failed to load news post', error);
  }

  if (!post) {
    notFound();
  }

  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <main>
      <Hero
        title={post.title}
        backgroundImage="/images/hero-background.png"
        size="medium"
      />

      <ContentSection heading="" description="" theme="dark">
        <article className="max-w-3xl mx-auto">
          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <span className="inline-block px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md bg-ez-pink/10 border border-ez-pink/20 text-ez-pink">
              {post.category}
            </span>
            {publishedDate && (
              <time dateTime={post.publishedAt?.toISOString()} className="text-xs text-slate-500">
                {publishedDate}
              </time>
            )}
          </div>

          {/* Article body */}
          <div className="prose prose-invert prose-sm sm:prose-base max-w-none text-slate-300 leading-relaxed">
            <Markdown content={post.content} />
          </div>

          {/* Back link */}
          <div className="mt-12 pt-8 border-t border-slate-800/60">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-ez-pink hover:underline text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to News
            </Link>
          </div>
        </article>
      </ContentSection>
    </main>
  );
}
