import Link from 'next/link';
import { GAMES, getGameSubRoute } from '@/app/lib/constants';
import Button from '@/app/components/ui/Button';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function TeamFightTacticsHubPage() {
  const game = GAMES['team-fight-tactics'];

  // Graceful fallbacks
  let record = '9-6';
  let nextMatch = { date: 'Saturday, March 15, 2025', teams: 'Stuyvesant vs. Staten Island Tech', division: 'Varsity' };
  let recentResults = [
    { date: 'March 8, 2025', teams: 'Stuyvesant vs. Brooklyn Tech', result: 'W 2-0', division: 'Varsity' },
    { date: 'March 1, 2025', teams: 'Stuyvesant vs. Midwood', result: 'L 1-2', division: 'Varsity' },
    { date: 'February 22, 2025', teams: 'Stuyvesant vs. Bronx Science', result: 'W 2-1', division: 'Varsity' },
  ];
  let topTeams = [
    { rank: 1, team: 'Midwood', wins: 11, losses: 4, winPct: 0.733 },
    { rank: 2, team: 'Stuyvesant', wins: 9, losses: 6, winPct: 0.600 },
    { rank: 3, team: 'Brooklyn Tech', wins: 8, losses: 7, winPct: 0.533 },
    { rank: 4, team: 'Bronx Science', wins: 7, losses: 8, winPct: 0.467 },
    { rank: 5, team: 'Staten Island Tech', wins: 6, losses: 9, winPct: 0.400 },
  ];

  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, 'team-fight-tactics'))
      .limit(1);

    if (gameRow[0]) {
      const gameId = gameRow[0].id;

      // 1. Record
      const stuyTeam = await db
        .select()
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.gameId, gameId),
            eq(schema.teams.name, 'Stuyvesant'),
            eq(schema.teams.division, 'Varsity')
          )
        )
        .limit(1);
      if (stuyTeam[0]) {
        record = `${stuyTeam[0].wins}-${stuyTeam[0].losses}`;
      }

      // 2. Next Match
      const activeSeason = await db
        .select()
        .from(schema.seasons)
        .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.isActive, true)))
        .limit(1);

      if (activeSeason[0]) {
        const teamRows = await db
          .select()
          .from(schema.teams)
          .where(eq(schema.teams.gameId, gameId));
        const teamMap = new Map(teamRows.map((t) => [t.id, t]));

        const nextMatchRow = await db
          .select()
          .from(schema.matches)
          .where(
            and(
              eq(schema.matches.seasonId, activeSeason[0].id),
              eq(schema.matches.status, 'scheduled')
            )
          )
          .orderBy(schema.matches.scheduledAt)
          .limit(1);

        if (nextMatchRow[0]) {
          const home = teamMap.get(nextMatchRow[0].homeTeamId);
          const away = teamMap.get(nextMatchRow[0].awayTeamId);
          nextMatch = {
            date: new Date(nextMatchRow[0].scheduledAt).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            teams: `${home?.name || 'Home'} vs. ${away?.name || 'Away'}`,
            division: home?.division || 'Varsity',
          };
        }

        // 3. Recent Results
        const recentRows = await db
          .select()
          .from(schema.matches)
          .where(
            and(
              eq(schema.matches.seasonId, activeSeason[0].id),
              eq(schema.matches.status, 'completed')
            )
          )
          .orderBy(desc(schema.matches.scheduledAt))
          .limit(3);

        if (recentRows.length > 0) {
          recentResults = recentRows.map((r) => {
            const home = teamMap.get(r.homeTeamId);
            const away = teamMap.get(r.awayTeamId);
            const isHomeStuy = home?.name === 'Stuyvesant';
            const stuyWon = r.homeScore! > r.awayScore! ? isHomeStuy : !isHomeStuy;
            return {
              date: new Date(r.scheduledAt).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
              teams: `${home?.name} vs. ${away?.name}`,
              result: `${stuyWon ? 'W' : 'L'} ${r.homeScore}-${r.awayScore}`,
              division: home?.division || 'Varsity',
            };
          });
        }
      }

      // 4. Top Teams
      const topRows = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.gameId, gameId))
        .orderBy(desc(schema.teams.wins))
        .limit(5);

      if (topRows.length > 0) {
        topTeams = topRows.map((t, idx) => {
          const played = t.wins + t.losses;
          const winPct = played > 0 ? t.wins / played : 0;
          return {
            rank: idx + 1,
            team: t.name,
            wins: t.wins,
            losses: t.losses,
            winPct,
          };
        });
      }
    }
  } catch (error) {
    console.error('Failed to load dynamic data for TFT', error);
  }

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
            <div className="text-3xl font-bold text-rose-300 mb-2">{record}</div>
            <div className="text-gray-400">Varsity Record</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-rose-300 mb-2">6-9</div>
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
            <div className="text-sm text-gray-600 mb-2">{nextMatch.date}</div>
            <div className="text-2xl font-bold text-gray-900 mb-4">{nextMatch.teams}</div>
            <div className="text-gray-600">{nextMatch.division} Division</div>
          </div>
          <div className="flex justify-center mt-6">
            <Link href={getGameSubRoute('team-fight-tactics', 'schedule')}>
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
          {recentResults.map((match, index) => (
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
          <Link href={getGameSubRoute('team-fight-tactics', 'standings')}>
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
                {topTeams.map((entry) => (
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
          <Link href={getGameSubRoute('team-fight-tactics', 'teams')}>
            <Button variant="primary">See All Teams</Button>
          </Link>
          <Link href={getGameSubRoute('team-fight-tactics', 'roster')}>
            <Button variant="secondary">View Roster</Button>
          </Link>
        </div>
      </ContentSection>
    </main>
  );
}
