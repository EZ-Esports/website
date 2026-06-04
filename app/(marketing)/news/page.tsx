import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { desc } from 'drizzle-orm';

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
      .orderBy(desc(schema.newsPosts.publishedAt));

    newsItems = postRows.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      excerpt: p.excerpt || '',
      date: new Date(p.publishedAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
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
              <div className="text-center p-12 text-gray-500 text-sm bg-gray-800 rounded-lg col-span-full">
                No league news articles found. Stay tuned for upcoming announcements!
              </div>
            ) : (
              newsItems.map((item) => (
                <Card key={item.id} className="bg-gray-800 text-white h-full flex flex-col">
                  <div className="flex-1">
                    <div className="text-sm text-rose-300 mb-2">{item.category}</div>
                    <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                    <p className="text-gray-400 mb-4">{item.excerpt}</p>
                  </div>
                  <div className="text-sm text-gray-500 border-t border-gray-700 pt-4 mt-4">
                    {item.date}
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
