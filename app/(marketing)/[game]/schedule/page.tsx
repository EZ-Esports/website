import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';

interface SchedulePageProps {
  params: Promise<{ game: string }>;
}

export default async function SchedulePage({ params }: SchedulePageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  // Placeholder schedule data
  const schedule = [
    { date: 'March 15, 2025', time: '2:00 PM', team1: 'Stuyvesant', team2: 'Bronx Science', division: 'Varsity', status: 'Upcoming' },
    { date: 'March 15, 2025', time: '4:00 PM', team1: 'Brooklyn Tech', team2: 'Midwood', division: 'Varsity', status: 'Upcoming' },
    { date: 'March 8, 2025', time: '2:00 PM', team1: 'Stuyvesant', team2: 'Brooklyn Tech', division: 'Varsity', status: 'Completed', result: 'W 2-0' },
    { date: 'March 8, 2025', time: '4:00 PM', team1: 'Bronx Science', team2: 'Staten Island Tech', division: 'Varsity', status: 'Completed', result: 'W 2-1' },
    { date: 'March 1, 2025', time: '2:00 PM', team1: 'Stuyvesant', team2: 'Midwood', division: 'Varsity', status: 'Completed', result: 'W 2-1' },
    { date: 'March 1, 2025', time: '4:00 PM', team1: 'Brooklyn Tech', team2: 'Staten Island Tech', division: 'Varsity', status: 'Completed', result: 'L 1-2' },
  ];

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Schedule`}
        description="View all scheduled matches for the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Week Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
                ← Previous Week
              </button>
              <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
                Next Week →
              </button>
            </div>
            <div className="text-white">Week 7</div>
          </div>

          {/* Division Filter */}
          <div className="mb-6 flex gap-2">
            <button className="px-4 py-2 bg-rose-300 text-gray-900 rounded font-semibold">
              Varsity
            </button>
            <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
              JV
            </button>
          </div>

          {/* Schedule List */}
          <div className="space-y-4">
            {schedule.map((match, index) => (
              <div
                key={index}
                className="bg-gray-800 rounded-lg p-6 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-2">
                    {match.date} • {match.time} • {match.division}
                  </div>
                  <div className="text-xl font-semibold text-white">
                    {match.team1} vs. {match.team2}
                  </div>
                </div>
                <div className="text-right">
                  {match.status === 'Completed' ? (
                    <div className="text-rose-300 font-bold">{match.result}</div>
                  ) : (
                    <div className="text-gray-400">Upcoming</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}



