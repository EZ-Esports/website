import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import Badge from '@/app/components/ui/Badge';
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

      <Section width="narrow">
        <article className="max-w-3xl mx-auto">
          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Badge size="sm">{post.category}</Badge>
            {publishedDate && (
              <time dateTime={post.publishedAt?.toISOString()} className="text-xs text-foreground-muted">
                {publishedDate}
              </time>
            )}
          </div>

          {/* Article body */}
          <div className="text-foreground-secondary leading-relaxed">
            <Markdown content={post.content} />
          </div>

          {/* Back link */}
          <div className="mt-12 pt-8 border-t border-line">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-accent hover:underline text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to News
            </Link>
          </div>
        </article>
      </Section>
    </main>
  );
}
