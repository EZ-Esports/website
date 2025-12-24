import Link from 'next/link';
import Image from 'next/image';
import { GAMES, getGameSubRoute } from '@/app/lib/constants';
import Button from '@/app/components/ui/Button';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';

export default function LeagueOfLegendsHubPage() {
  const game = GAMES['league-of-legends'];

  return (
    <main>
      {/* Hero Section */}
      <Hero
        title={game.displayName}
        backgroundImage={game.imageUrl}
      />

      {/* Quick Stats Section */}
      <ContentSection
        heading="Current Season"
        description=""
        theme="dark"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-rose-300 mb-2">10-5</div>
            <div className="text-gray-400">Varsity Record</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-rose-300 mb-2">7-8</div>
            <div className="text-gray-400">JV Record</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-rose-300 mb-2">Week 7</div>
            <div className="text-gray-400">Current Week</div>
          </div>
        </div>
      </ContentSection>

      {/* Next Match Preview */}
      <ContentSection
        heading="Next Match"
        description=""
        theme="light"
      >
        <div className="max-w-2xl mx-auto bg-white rounded-lg p-6 shadow-lg">
          <div className="text-center mb-4">
            <div className="text-sm text-gray-600 mb-2">Saturday, March 15, 2025</div>
            <div className="text-2xl font-bold text-gray-900 mb-4">Stuyvesant vs. Brooklyn Tech</div>
            <div className="text-gray-600">Varsity Division</div>
          </div>
          <div className="flex justify-center mt-6">
            <Link href={getGameSubRoute('league-of-legends', 'schedule')}>
              <Button variant="primary">View Full Schedule</Button>
            </Link>
          </div>
        </div>
      </ContentSection>

      {/* Recent Results */}
      <ContentSection
        heading="Recent Results"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {[
            { date: 'March 8, 2025', teams: 'Stuyvesant vs. Midwood', result: 'W 2-0', division: 'Varsity' },
            { date: 'March 1, 2025', teams: 'Stuyvesant vs. Staten Island Tech', result: 'W 2-1', division: 'Varsity' },
            { date: 'February 22, 2025', teams: 'Stuyvesant vs. Bronx Science', result: 'L 0-2', division: 'Varsity' },
          ].map((match, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400 mb-1">{match.date}</div>
                <div className="text-white font-semibold">{match.teams}</div>
                <div className="text-sm text-gray-400 mt-1">{match.division}</div>
              </div>
              <div className="text-rose-300 font-bold">{match.result}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Link href={getGameSubRoute('league-of-legends', 'standings')}>
            <Button variant="secondary">View Full Standings</Button>
          </Link>
        </div>
      </ContentSection>

      {/* Standings Preview */}
      <ContentSection
        heading="Top Teams"
        description=""
        theme="light"
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">W-L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Win %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[
                  { rank: 1, team: 'Bronx Science', wins: 13, losses: 2, winPct: 0.867 },
                  { rank: 2, team: 'Stuyvesant', wins: 10, losses: 5, winPct: 0.667 },
                  { rank: 3, team: 'Brooklyn Tech', wins: 9, losses: 6, winPct: 0.600 },
                  { rank: 4, team: 'Midwood', wins: 8, losses: 7, winPct: 0.533 },
                  { rank: 5, team: 'Staten Island Tech', wins: 7, losses: 8, winPct: 0.467 },
                ].map((entry) => (
                  <tr key={entry.rank}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.rank}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.team}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.wins}-{entry.losses}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(entry.winPct * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-6">
          <Link href={getGameSubRoute('league-of-legends', 'teams')}>
            <Button variant="primary">See All Teams</Button>
          </Link>
          <Link href={getGameSubRoute('league-of-legends', 'roster')}>
            <Button variant="secondary">View Roster</Button>
          </Link>
        </div>
      </ContentSection>
    </main>
  );
}

