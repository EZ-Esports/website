// app/(marketing)/leadership/[year]/page.tsx
import { getCachedLeadership } from '@/app/lib/db/queries';
import { notFound } from 'next/navigation';
import type { LeadershipParams } from '@/app/types';
import { getLeadershipRoute } from '@/app/lib/constants';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';

export default async function LeadershipPage({ params }: { params: Promise<LeadershipParams> }) {
  const { year } = await params;
  let allLeaders: Awaited<ReturnType<typeof getCachedLeadership>> = [];
  try {
    allLeaders = await getCachedLeadership();
  } catch (error) {
    console.error('Failed to load leadership data', error);
  }

  const years = Array.from(new Set(allLeaders.map((l) => l.year))).sort().reverse();
  const leaders = allLeaders.filter((l) => l.year === year);
  
  // If year doesn't exist in data and we have leadership records, show 404
  if (years.length > 0 && !years.includes(year)) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-20">
      {/* Page Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight uppercase text-foreground">
          {year} Leadership Team
        </h1>
        <div className="w-12 h-0.5 bg-custom-border mx-auto rounded-full mb-4" />
        <p className="text-foreground-secondary font-medium">
          Meet the leaders who guide our organization
        </p>
      </div>

      {/* Year Selector */}
      <div className="mb-12 flex justify-center gap-2">
        {years.map((y) => {
          const isActive = y === year;
          return (
            <Link
              key={y}
              href={getLeadershipRoute(y)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-ez-pink text-white font-bold scale-105 shadow-none'
                  : 'bg-background-secondary border border-custom-border/80 text-foreground-secondary hover:text-foreground hover:bg-background'
              }`}
            >
              {y}
            </Link>
          );
        })}
      </div>

      {/* Leadership Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {leaders.length === 0 ? (
          <div className="p-16 text-center text-foreground-secondary text-sm bg-background-secondary/20 rounded-2xl col-span-full border border-custom-border">
            No leadership members registered for {year} yet.
          </div>
        ) : (
          leaders.map((leader) => (
            <Card key={leader.name} className="hover:scale-[1.02] duration-300">
              {/* Placeholder for image */}
              <div className="w-28 h-28 rounded-full mx-auto mb-6 bg-background border-2 border-custom-border flex items-center justify-center text-foreground">
                <span className="text-3xl font-extrabold tracking-tight">
                  {leader.name.split(' ').map((n: string) => n[0]).join('')}
                </span>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-bold mb-1 tracking-tight text-foreground">{leader.name}</h2>
                <p className="text-ez-pink text-sm font-bold uppercase tracking-widest mb-3">{leader.role}</p>
                
                {leader.bio && (
                  <p className="text-foreground-secondary text-sm leading-relaxed border-t border-custom-border/80 pt-3 mt-3">{leader.bio}</p>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

// Generate static params dynamically
export async function generateStaticParams() {
  try {
    const allLeaders = await getCachedLeadership();
    const years = Array.from(new Set(allLeaders.map((l) => l.year)));
    return years.map((year) => ({
      year,
    }));
  } catch {
    return [];
  }
}

// Generate metadata dynamically
export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return {
    title: `${year} Leadership Team`,
    description: `Meet the ${year} leadership team of our organization`,
  };
}