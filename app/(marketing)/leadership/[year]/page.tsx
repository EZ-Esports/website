// app/(marketing)/leadership/[year]/page.tsx
import { getCachedLeadership } from '@/app/lib/db/queries';
import { notFound } from 'next/navigation';
import type { LeadershipParams } from '@/app/types';
import { getLeadershipRoute } from '@/app/lib/constants';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

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
    <main>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Leadership"
          title={`${year} Leadership Team`}
          lead="Meet the leaders who guide our organization"
        />

        {/* Year Selector */}
        <div className="mb-12 flex flex-wrap justify-center gap-2">
          {years.map((y) => (
            <Button
              key={y}
              href={getLeadershipRoute(y)}
              variant={y === year ? 'primary' : 'outline'}
              size="sm"
            >
              {y}
            </Button>
          ))}
        </div>

        {/* Leadership Grid */}
        <div className="flex flex-wrap justify-center gap-8">
          {leaders.length === 0 ? (
            <Card className="w-full text-center py-16">
              <p className="text-foreground-secondary text-sm">
                No leadership members registered for {year} yet.
              </p>
            </Card>
          ) : (
            leaders.map((leader) => (
              <Card key={leader.name} interactive className="w-full md:w-[calc(50%_-_1rem)] lg:w-[calc(33.333%_-_1.333rem)]">
                {/* Placeholder for image */}
                <div className="w-28 h-28 rounded-full mx-auto mb-6 bg-surface border-2 border-line flex items-center justify-center text-foreground">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {leader.name.split(' ').map((n: string) => n[0]).join('')}
                  </span>
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-bold mb-1 tracking-tight text-foreground">{leader.name}</h2>
                  <p className="text-accent text-sm font-bold uppercase tracking-widest mb-3">{leader.role}</p>

                  {leader.bio && (
                    <p className="text-foreground-secondary text-sm leading-relaxed border-t border-line pt-3 mt-3">{leader.bio}</p>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </Section>
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
