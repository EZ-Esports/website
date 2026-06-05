// app/(marketing)/leadership/[year]/page.tsx
import { leadershipByYear } from '@/app/lib/leadership-data';
import { notFound } from 'next/navigation';
import type { LeadershipParams } from '@/app/types';
import { getLeadershipRoute } from '@/app/lib/constants';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';

export default async function LeadershipPage({ params }: { params: Promise<LeadershipParams> }) {
  const { year } = await params;
  const leaders = leadershipByYear[year];
  
  // If year doesn't exist in data, show 404
  if (!leaders) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-20">
      {/* Page Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight uppercase">
          {year} Leadership Team
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-ez-pink to-ez-purple mx-auto rounded-full mb-4" />
        <p className="text-slate-400 font-medium">
          Meet the leaders who guide our organization
        </p>
      </div>

      {/* Year Selector */}
      <div className="mb-12 flex justify-center gap-2">
        {Object.keys(leadershipByYear).map((y) => {
          const isActive = y === year;
          return (
            <Link
              key={y}
              href={getLeadershipRoute(y)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-ez-pink to-ez-purple text-white shadow-lg shadow-ez-pink/15 scale-105'
                  : 'bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {y}
            </Link>
          );
        })}
      </div>

      {/* Leadership Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {leaders.map((leader) => (
          <Card key={leader.name} className="hover:scale-[1.02] duration-300">
            {/* When you add images, uncomment below and add image to leadership-data.ts */}
            {/* 
            <img 
              src={leader.image} 
              alt={leader.name}
              className="w-28 h-28 rounded-full mx-auto mb-6 object-cover border-2 border-ez-pink/20"
            />
            */}
            
            {/* Placeholder for image */}
            <div className="w-28 h-28 rounded-full mx-auto mb-6 bg-gradient-to-tr from-ez-pink/10 to-ez-purple/20 border-2 border-ez-pink/25 flex items-center justify-center text-ez-pink shadow-lg shadow-ez-pink/5">
              <span className="text-3xl font-extrabold tracking-tight">
                {leader.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-bold mb-1 tracking-tight text-white">{leader.name}</h2>
              <p className="text-ez-pink text-sm font-bold uppercase tracking-widest mb-3">{leader.role}</p>
              
              {/* Optional: Add bio */}
              {leader.bio && (
                <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800/80 pt-3 mt-3">{leader.bio}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}

// Generate static pages for each year at build time
export async function generateStaticParams() {
  return Object.keys(leadershipByYear).map((year) => ({
    year,
  }));
}

// Optional: Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return {
    title: `${year} Leadership Team`,
    description: `Meet the ${year} leadership team of our organization`,
  };
}