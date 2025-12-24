// app/(marketing)/leadership/[year]/page.tsx
import { leadershipByYear } from '@/app/lib/leadership-data';
import { notFound } from 'next/navigation';
import type { LeadershipParams } from '@/app/types';
import { getLeadershipRoute } from '@/app/lib/constants';
import Link from 'next/link';

export default async function LeadershipPage({ params }: { params: Promise<LeadershipParams> }) {
  const { year } = await params;
  const leaders = leadershipByYear[year];
  
  // If year doesn't exist in data, show 404
  if (!leaders) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">
          {year} Leadership Team
        </h1>
        <p className="text-lg text-gray-600">
          Meet the leaders who guide our organization
        </p>
      </div>

      {/* Year Selector - Optional */}
      <div className="mb-8 flex justify-center gap-2">
        {Object.keys(leadershipByYear).map((y) => (
          <Link
            key={y}
            href={getLeadershipRoute(y)}
            className={`px-4 py-2 rounded ${
              y === year
                ? 'bg-rose-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {/* Leadership Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {leaders.map((leader) => (
          <div key={leader.name} className="bg-white rounded-lg shadow-md p-6">
            {/* When you add images, uncomment below and add image to leadership-data.ts */}
            {/* 
            <img 
              src={leader.image} 
              alt={leader.name}
              className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
            />
            */}
            
            {/* Placeholder for image */}
            <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gray-300 flex items-center justify-center">
              <span className="text-4xl text-gray-500">
                {leader.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">{leader.name}</h2>
              <p className="text-rose-500 font-medium mb-2">{leader.role}</p>
              
              {/* Optional: Add bio */}
              {leader.bio && (
                <p className="text-gray-600 text-sm">{leader.bio}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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