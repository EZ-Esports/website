import { notFound } from 'next/navigation';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';

interface TeamsPageProps {
  params: Promise<{ game: string }>;
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { game } = await params;
  
  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];

  // Placeholder teams data
  const teams = [
    { id: '1', name: 'Stuyvesant', record: '12-3', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '2', name: 'Bronx Science', record: '11-4', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '3', name: 'Brooklyn Tech', record: '10-5', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '4', name: 'Midwood', record: '9-6', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '5', name: 'Staten Island Tech', record: '8-7', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '6', name: 'Queens Tech', record: '6-9', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '7', name: 'Manhattan Center', record: '5-10', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
    { id: '8', name: 'Brooklyn Latin', record: '4-11', division: 'Varsity', logoUrl: '/images/logos/logo.png' },
  ];

  return (
    <main>
      <ContentSection
        heading={`${gameConfig.displayName} Teams`}
        description="All teams competing in the current season"
        theme="dark"
      >
        <div className="max-w-6xl mx-auto">
          {/* Division Filter */}
          <div className="mb-6 flex gap-2">
            <button className="px-4 py-2 bg-rose-300 text-gray-900 rounded font-semibold">
              Varsity
            </button>
            <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
              JV
            </button>
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="bg-gray-800 text-white">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="w-20 h-20 mx-auto bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold">{team.name.charAt(0)}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{team.name}</h3>
                  <div className="text-gray-400 text-sm mb-1">{team.division}</div>
                  <div className="text-rose-300 font-bold">{team.record}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}



