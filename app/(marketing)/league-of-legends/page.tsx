import type { Metadata } from 'next';
import Link from 'next/link';
import { GAMES, getGameSubRoute } from '@/app/lib/constants';
import Button from '@/app/components/ui/Button';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'League of Legends | EZ Esports',
  description:
    'Follow the EZ Esports League of Legends division — standings, schedules, match results, and school rosters for NYC high-school LoL competition.',
};

export default async function LeagueOfLegendsHubPage() {
  const game = GAMES['league-of-legends'];

  // Empty-state defaults — no fabricated data
  let record: string | null = null;
  let jvRecord: string | null = null;
  let nextMatch: { date: string; teams: string; division: string } | null = null;
  let recentResults: { date: string; teams: string; result: string; division: string }[] = [];
  let topTeams: { rank: number; team: string; wins: number; losses: number; winPct: number }[] = [];

  try {
    const gameRow = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.slug, 'league-of-legends'))
      .limit(1);

    if (gameRow[0]) {
      const gameId = gameRow[0].id;

      const teamRows = await db
        .select({
          id: schema.teams.id,
          schoolId: schema.teams.schoolId,
          gameId: schema.teams.gameId,
          seasonId: schema.teams.seasonId,
          name: schema.schools.name,
        })
        .from(schema.teams)
        .innerJoin(schema.schools, eq(schema.teams.schoolId, schema.schools.id))
        .where(and(eq(schema.teams.gameId, gameId), isNull(schema.schools.deletedAt)));
      const teamMap = new Map(teamRows.map((t) => [t.id, t]));
      const teamIds = teamRows.map((t) => t.id);

      const rosterRows = teamIds.length > 0
        ? await db.select().from(schema.rosters).where(inArray(schema.rosters.teamId, teamIds))
        : [];
      const rosterMap = new Map(rosterRows.map((r) => [r.id, r]));

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

        recentResults = recentRows.map((r) => {
          const homeRoster = rosterMap.get(r.homeRosterId);
          const awayRoster = rosterMap.get(r.awayRosterId);
          const home = homeRoster ? teamMap.get(homeRoster.teamId) : null;
          const away = awayRoster ? teamMap.get(awayRoster.teamId) : null;
          const homeWon = (r.homeScore ?? 0) > (r.awayScore ?? 0);
          return {
            date: new Date(r.scheduledAt).toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            teams: `${home?.name ?? 'Home'} vs. ${away?.name ?? 'Away'}`,
            result: `${homeWon ? 'W' : 'L'} ${r.homeScore ?? 0}-${r.awayScore ?? 0}`,
            division: homeRoster?.division || 'Varsity',
          };
        });
      }

      const topRows = teamIds.length > 0
        ? await db
            .select()
            .from(schema.rosterStandings)
            .where(
              and(
                inArray(schema.rosterStandings.teamId, teamIds),
                eq(schema.rosterStandings.division, 'Varsity')
              )
            )
            .orderBy(desc(schema.rosterStandings.wins), schema.rosterStandings.losses)
            .limit(5)
        : [];

      topTeams = topRows.map((r, idx) => {
        const team = teamMap.get(r.teamId!);
        const wins = r.wins || 0;
        const losses = r.losses || 0;
        const played = wins + losses;
        const winPct = played > 0 ? wins / played : 0;
        return { rank: idx + 1, team: team?.name || 'Unknown', wins, losses, winPct };
      });

      if (topRows.length > 0) {
        const totalVarsityW = topRows.reduce((acc, r) => acc + (r.wins || 0), 0);
        const totalVarsityL = topRows.reduce((acc, r) => acc + (r.losses || 0), 0);
        record = `${totalVarsityW}-${totalVarsityL}`;

        const jvRows = teamIds.length > 0
          ? await db
              .select()
              .from(schema.rosterStandings)
              .where(
                and(
                  inArray(schema.rosterStandings.teamId, teamIds),
                  eq(schema.rosterStandings.division, 'JV')
                )
              )
          : [];
        if (jvRows.length > 0) {
          jvRecord = `${jvRows.reduce((a, r) => a + (r.wins || 0), 0)}-${jvRows.reduce((a, r) => a + (r.losses || 0), 0)}`;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load dynamic data for League of Legends', error);
  }

  return (
    <main>
      <Hero
        title={game.displayName}
        backgroundImage={game.imageUrl}
        size="medium"
      />

      <ContentSection heading="Current Season" description="" theme="dark">
        {record === null && jvRecord === null ? (
          <div className="text-center py-8 text-foreground-secondary text-sm">
            Season stats will appear once the season is underway.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {record !== null && (
              <Card className="hover:scale-[1.03] transition-all text-center">
                <div className="text-4xl font-black text-ez-pink mb-2">{record}</div>
                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">League Varsity Record</div>
              </Card>
            )}
            {jvRecord !== null && (
              <Card className="hover:scale-[1.03] transition-all text-center">
                <div className="text-4xl font-black text-ez-pink mb-2">{jvRecord}</div>
                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">League JV Record</div>
              </Card>
            )}
          </div>
        )}
      </ContentSection>

      <ContentSection heading="Next Match" description="" theme="light">
        {nextMatch === null ? (
          <div className="text-center py-8 text-foreground-secondary text-sm">
            No upcoming matches scheduled.{' '}
            <Link href={getGameSubRoute('league-of-legends', 'schedule')} className="text-ez-pink hover:underline">
              View full schedule
            </Link>
          </div>
        ) : (
          <Card className="max-w-2xl mx-auto hover:scale-[1.01] transition-all">
            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 text-ez-pink text-xs font-bold uppercase tracking-widest mb-4">
                Upcoming Match
              </span>
              <div className="text-xs text-foreground-secondary font-bold uppercase tracking-wider mb-2">{nextMatch.date}</div>
              <div className="text-2xl sm:text-3xl font-black text-foreground mb-2 tracking-tight">{nextMatch.teams}</div>
              <div className="text-foreground-secondary text-sm font-medium mb-6">{nextMatch.division} Division</div>
              <div className="flex justify-center">
                <Link href={getGameSubRoute('league-of-legends', 'schedule')}>
                  <Button variant="primary">View Full Schedule</Button>
                </Link>
              </div>
            </div>
          </Card>
        )}
      </ContentSection>

      <ContentSection heading="Recent Results" description="" theme="dark">
        {recentResults.length === 0 ? (
          <div className="text-center py-8 text-foreground-secondary text-sm">
            No completed matches yet. Check back after season play begins.
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {recentResults.map((match, index) => {
              const isWin = match.result.startsWith('W');
              return (
                <div
                  key={index}
                  className="bg-background-secondary/80 border border-custom-border/80 rounded-xl p-5 flex items-center justify-between hover:border-ez-pink/50 transition-all duration-300"
                >
                  <div>
                    <div className="text-xs text-foreground-secondary font-medium mb-1">{match.date} • {match.division} Division</div>
                    <div className="text-foreground text-lg font-bold tracking-tight">{match.teams}</div>
                  </div>
                  <div>
                    <span className={`inline-block px-3.5 py-1 rounded-full text-sm font-extrabold ${
                      isWin
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-ez-pink/10 border border-ez-pink/20 text-ez-pink'
                    }`}>
                      {match.result}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-center mt-10">
          <Link href={getGameSubRoute('league-of-legends', 'standings')}>
            <Button variant="secondary">View Full Standings</Button>
          </Link>
        </div>
      </ContentSection>

      <ContentSection heading="Top Teams" description="" theme="light">
        {topTeams.length === 0 ? (
          <div className="text-center py-8 text-foreground-secondary text-sm">
            No standings yet. Check back once season play begins.
          </div>
        ) : (
          <div className="max-w-4xl mx-auto mb-10">
            <div className="overflow-x-auto">
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-900/60 border-b border-slate-800/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Rank</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Team</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">W-L</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Win %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topTeams.map((entry) => (
                      <tr key={entry.rank} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-300">
                          {entry.rank === 1 ? (
                            <span className="text-yellow-500 font-bold">
                              <span aria-hidden="true">🏆 </span>
                              <span>1</span>
                            </span>
                          ) : entry.rank === 2 ? (
                            <span className="text-slate-400">
                              <span aria-hidden="true">🥈 </span>
                              <span>2</span>
                            </span>
                          ) : entry.rank === 3 ? (
                            <span className="text-amber-600">
                              <span aria-hidden="true">🥉 </span>
                              <span>3</span>
                            </span>
                          ) : (
                            entry.rank
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-white">{entry.team}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-400">{entry.wins}-{entry.losses}</td>
                        <td className="px-6 py-4 text-sm font-bold text-white">{(entry.winPct * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-center mt-6">
          <Link href={getGameSubRoute('league-of-legends', 'teams')}>
            <Button variant="primary">See Teams &amp; Rosters</Button>
          </Link>
        </div>
      </ContentSection>
    </main>
  );
}
