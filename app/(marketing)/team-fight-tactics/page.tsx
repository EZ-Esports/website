import Link from 'next/link';
import { GAMES, getGameSubRoute } from '@/app/lib/constants';
import Button from '@/app/components/ui/Button';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export default async function TFTHubPage() {
  const game = GAMES['team-fight-tactics'];

  // Graceful fallbacks
  let record = '9-6';
  let jvRecord = '6-9';
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

      // Get team rows
      const teamRows = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.gameId, gameId));
      const teamMap = new Map(teamRows.map((t) => [t.id, t]));
      const teamIds = teamRows.map((t) => t.id);

      const rosterRows = teamIds.length > 0
        ? await db.select().from(schema.rosters).where(inArray(schema.rosters.teamId, teamIds))
        : [];
      const rosterMap = new Map(rosterRows.map((r) => [r.id, r]));

      // 1. Record
      const stuyTeam = teamRows.find((t) => t.name === 'Stuyvesant');
      if (stuyTeam) {
        const varsityRoster = rosterRows.find((r) => r.teamId === stuyTeam.id && r.division === 'Varsity');
        if (varsityRoster) {
          record = `${varsityRoster.wins}-${varsityRoster.losses}`;
        }
        const jvRoster = rosterRows.find((r) => r.teamId === stuyTeam.id && r.division === 'JV');
        if (jvRoster) {
          jvRecord = `${jvRoster.wins}-${jvRoster.losses}`;
        }
      }

      // 2. Next Match
      const activeSeason = await db
        .select()
        .from(schema.seasons)
        .where(and(eq(schema.seasons.gameId, gameId), eq(schema.seasons.isActive, true)))
        .limit(1);

      if (activeSeason[0]) {
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
          const homeRoster = rosterMap.get(nextMatchRow[0].homeRosterId);
          const awayRoster = rosterMap.get(nextMatchRow[0].awayRosterId);
          const home = homeRoster ? teamMap.get(homeRoster.teamId) : null;
          const away = awayRoster ? teamMap.get(awayRoster.teamId) : null;
          nextMatch = {
            date: new Date(nextMatchRow[0].scheduledAt).toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            teams: `${home?.name || 'Home'} vs. ${away?.name || 'Away'}`,
            division: homeRoster?.division || 'Varsity',
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
            const homeRoster = rosterMap.get(r.homeRosterId);
            const awayRoster = rosterMap.get(r.awayRosterId);
            const home = homeRoster ? teamMap.get(homeRoster.teamId) : null;
            const away = awayRoster ? teamMap.get(awayRoster.teamId) : null;
            const isHomeStuy = home?.name === 'Stuyvesant';
            const stuyWon = r.homeScore! > r.awayScore! ? isHomeStuy : !isHomeStuy;
            return {
              date: new Date(r.scheduledAt).toLocaleDateString('en-US', {
                timeZone: 'America/New_York',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
              teams: `${home?.name} vs. ${away?.name}`,
              result: `${stuyWon ? 'W' : 'L'} ${r.homeScore}-${r.awayScore}`,
              division: homeRoster?.division || 'Varsity',
            };
          });
        }
      }

      // 4. Top Teams
      const topRows = teamIds.length > 0
        ? await db
            .select()
            .from(schema.rosters)
            .where(
              and(
                inArray(schema.rosters.teamId, teamIds),
                eq(schema.rosters.division, 'Varsity')
              )
            )
            .orderBy(desc(schema.rosters.wins), schema.rosters.losses)
            .limit(5)
        : [];

      if (topRows.length > 0) {
        topTeams = topRows.map((r, idx) => {
          const team = teamMap.get(r.teamId);
          const played = r.wins + r.losses;
          const winPct = played > 0 ? r.wins / played : 0;
          return {
            rank: idx + 1,
            team: team?.name || 'Unknown',
            wins: r.wins,
            losses: r.losses,
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
        size="medium"
      />

      {/* Quick Stats Section */}
      <ContentSection
        heading="Current Season"
        description=""
        theme="dark"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="hover:scale-[1.03] transition-all text-center">
            <div className="text-4xl font-black text-ez-pink mb-2">{record}</div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Varsity Record</div>
          </Card>
          <Card className="hover:scale-[1.03] transition-all text-center">
            <div className="text-4xl font-black text-ez-pink mb-2">{jvRecord}</div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">JV Record</div>
          </Card>
          <Card className="hover:scale-[1.03] transition-all text-center">
            <div className="text-4xl font-black text-ez-pink mb-2">Week 7</div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Current Week</div>
          </Card>
        </div>
      </ContentSection>

      {/* Next Match Preview */}
      <ContentSection
        heading="Next Match"
        description=""
        theme="light"
      >
        <Card className="max-w-2xl mx-auto hover:scale-[1.01] transition-all">
          <div className="text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 text-ez-pink text-xs font-bold uppercase tracking-widest mb-4">
              Upcoming Match
            </span>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{nextMatch.date}</div>
            <div className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">{nextMatch.teams}</div>
            <div className="text-slate-400 text-sm font-medium mb-6">{nextMatch.division} Division</div>
            
            <div className="flex justify-center">
              <Link href={getGameSubRoute('team-fight-tactics', 'schedule')}>
                <Button variant="primary">View Full Schedule</Button>
              </Link>
            </div>
          </div>
        </Card>
      </ContentSection>

      {/* Recent Results */}
      <ContentSection
        heading="Recent Results"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {recentResults.map((match, index) => {
            const isWin = match.result.startsWith('W');
            return (
              <div 
                key={index} 
                className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex items-center justify-between hover:border-slate-700/60 transition-colors"
              >
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">{match.date} • {match.division} Division</div>
                  <div className="text-white text-lg font-bold tracking-tight">{match.teams}</div>
                </div>
                <div>
                  <span className={`inline-block px-3.5 py-1 rounded-full text-sm font-extrabold ${
                    isWin 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-500/10 border border-rose-500/20 text-ez-pink'
                  }`}>
                    {match.result}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center mt-10">
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
        <div className="max-w-4xl mx-auto mb-10">
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            <table className="w-full border-collapse">
              <thead className="bg-[#0b101d] border-b border-slate-800/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Team</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">W-L</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {topTeams.map((entry) => {
                  return (
                    <tr key={entry.rank} className="hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-300">
                        {entry.rank === 1 ? (
                          <span className="text-yellow-500 font-bold">🏆 1</span>
                        ) : entry.rank === 2 ? (
                          <span className="text-slate-400">🥈 2</span>
                        ) : entry.rank === 3 ? (
                          <span className="text-amber-600">🥉 3</span>
                        ) : (
                          entry.rank
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-white">{entry.team}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-400">{entry.wins}-{entry.losses}</td>
                      <td className="px-6 py-4 text-sm font-bold text-white">{(entry.winPct * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-center mt-6">
          <Link href={getGameSubRoute('team-fight-tactics', 'teams')}>
            <Button variant="primary">See Teams & Rosters</Button>
          </Link>
        </div>
      </ContentSection>
    </main>
  );
}
