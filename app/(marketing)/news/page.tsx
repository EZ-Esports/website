import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'News & Announcements | EZ Esports',
  description: 'Stay up to date with the latest news, tournament updates, and announcements from the EZ Esports NYC high-school esports league.',
};

export default async function NewsPage() {
  interface NewsItem {
    id: string;
    title: string;
    category: string;
    excerpt: string;
    date: string;
  }

  let newsItems: NewsItem[] = [];
  try {
    const postRows = await db
      .select()
      .from(schema.newsPosts)
      .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)))
      .orderBy(desc(schema.newsPosts.publishedAt));

    newsItems = postRows.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      excerpt: p.excerpt || '',
      date: p.publishedAt
        ? new Date(p.publishedAt).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : '',
    }));
  } catch (error) {
    console.error('Failed to load news posts from database', error);
  }

  return (
    <main>
      <Hero
        title="League News"
        backgroundImage="/images/hero-background.jpg"
      />

      <Section>
        <SectionHeader
          title="Latest News & Announcements"
          lead="Stay up to date with the latest news, updates, and announcements from the league"
        />

        <div className="flex flex-wrap justify-center gap-6">
          {newsItems.length === 0 ? (
            <Card className="w-full text-center py-12">
              <p className="text-foreground-secondary text-sm">
                No league news articles found. Stay tuned for upcoming announcements!
              </p>
            </Card>
          ) : (
            newsItems.map((item) => (
              <Card
                key={item.id}
                as="article"
                interactive
                className="w-full md:w-[calc(50%_-_0.75rem)] lg:w-[calc(33.333%_-_1rem)] h-full flex flex-col"
              >
                <div className="flex-1">
                  <Badge size="sm" className="mb-3">{item.category}</Badge>
                  <Link href={`/news/${item.id}`}>
                    <h2 className="text-xl font-bold text-foreground mb-2 tracking-tight line-clamp-2 hover:text-accent transition-colors">{item.title}</h2>
                  </Link>
                  <p className="text-foreground-secondary text-sm leading-relaxed mb-4 line-clamp-3">{item.excerpt}</p>
                </div>
                <div className="text-xs text-foreground-muted border-t border-line pt-3 mt-4 flex items-center justify-between">
                  <span>{item.date}</span>
                  <Link
                    href={`/news/${item.id}`}
                    className="text-accent font-semibold hover:underline"
                  >
                    Read More →
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </Section>
    </main>
  );
}
