import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';
import Card from '@/app/components/ui/Card';

export default function NewsPage() {
  const newsItems = [
    {
      id: '1',
      title: 'Spring 2025 Season Kicks Off',
      date: 'February 15, 2025',
      excerpt: 'The Spring 2025 season has officially begun with record participation across all three games.',
      category: 'Announcement',
    },
    {
      id: '2',
      title: 'Championship Tournament Dates Announced',
      date: 'February 10, 2025',
      excerpt: 'Mark your calendars! The championship tournament will take place on May 15-17, 2025.',
      category: 'Tournament',
    },
    {
      id: '3',
      title: 'New Streaming Partnership',
      date: 'February 5, 2025',
      excerpt: 'We are excited to announce a new partnership that will enhance our live streaming capabilities.',
      category: 'Partnership',
    },
    {
      id: '4',
      title: 'Player of the Month: January',
      date: 'February 1, 2025',
      excerpt: 'Congratulations to our January Player of the Month for outstanding performance and sportsmanship.',
      category: 'Recognition',
    },
    {
      id: '5',
      title: 'Registration Open for Fall 2025',
      date: 'January 25, 2025',
      excerpt: 'Registration for the Fall 2025 season is now open. Sign up your team today!',
      category: 'Registration',
    },
    {
      id: '6',
      title: 'Mid-Season Update',
      date: 'January 20, 2025',
      excerpt: 'Check out the latest standings and highlights from the first half of the season.',
      category: 'Update',
    },
  ];

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
            {newsItems.map((item) => (
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
            ))}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}

