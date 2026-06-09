import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

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
        backgroundImage="/images/hero-background.png"
      />

      <ContentSection
        heading="Latest News & Announcements"
        description="Stay up to date with the latest news, updates, and announcements from the league"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newsItems.length === 0 ? (
              <div className="text-center p-12 text-slate-400 text-sm bg-slate-900/30 border border-slate-800/60 rounded-xl col-span-full">
                No league news articles found. Stay tuned for upcoming announcements!
              </div>
            ) : (
              newsItems.map((item) => (
                <Card key={item.id} className="text-white h-full flex flex-col hover:scale-[1.02] transition-all duration-300">
                  <div className="flex-1">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md bg-ez-pink/10 border border-ez-pink/20 text-ez-pink mb-3">
                      {item.category}
                    </span>
                    <h3 className="text-xl font-bold mb-2 tracking-tight line-clamp-2 hover:text-ez-pink transition-colors cursor-pointer">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">{item.excerpt}</p>
                  </div>
                  <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-3 mt-4 flex items-center justify-between">
                    <span>{item.date}</span>
                    <span className="text-ez-pink font-semibold hover:underline cursor-pointer">Read More →</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}
