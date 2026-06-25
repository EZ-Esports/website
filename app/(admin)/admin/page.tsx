import { getCachedGames, getCachedTeams, countScheduledMatches, countPublishedNews, countPendingResults, countTeamsWithoutRoster } from '@/app/lib/db/queries';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { HiOutlineTrophy, HiOutlineUsers, HiOutlineCalendarDays, HiOutlineNewspaper, HiExclamationTriangle, HiInformationCircle } from 'react-icons/hi2';

export default async function AdminDashboardPage() {
  let stats = { games: 0, teams: 0, scheduledMatches: 0, publishedNews: 0 };
  let dbConfigured = false;
  let connectionError = '';
  let alerts: Array<{
    type: 'warning' | 'info';
    label: string;
    count: number;
    message: string;
    link: string;
    linkText: string;
  }> = [];

  try {
    if (process.env.DATABASE_URL) {
      const [games, teams, scheduledMatchCount, publishedNewsCount, pendingResults, teamsWithNoRoster] = await Promise.all([
        getCachedGames(),
        getCachedTeams(),
        countScheduledMatches(),
        countPublishedNews(),
        countPendingResults(),
        countTeamsWithoutRoster(),
      ]);

      stats = {
        games: games.length,
        teams: teams.length,
        scheduledMatches: scheduledMatchCount,
        publishedNews: publishedNewsCount,
      };

      alerts = [
        ...(pendingResults > 0 ? [{
          type: 'warning' as const,
          label: 'Pending Results',
          count: pendingResults,
          message: `${pendingResults} past ${pendingResults === 1 ? 'match still needs' : 'matches still need'} final scores.`,
          link: '/admin/matches',
          linkText: 'Enter Scores'
        }] : []),
        ...(teamsWithNoRoster > 0 ? [{
          type: 'info' as const,
          label: 'Incomplete Teams',
          count: teamsWithNoRoster,
          message: `${teamsWithNoRoster} registered teams have no competitive rosters assigned.`,
          link: '/admin/roster',
          linkText: 'Assign Rosters'
        }] : [])
      ];

      dbConfigured = true;
    }
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Database connection error';
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <Card className="bg-slate-900/30 border border-slate-800 border-l-4 border-l-ez-pink rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-none duration-300">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Welcome to <span className="text-ez-pink">EZ</span> Staff</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed max-w-xl">
            Manage public competition schedules, teams, roster lists, and news announcements from a single, unified database dashboard.
          </p>
        </div>
        <Button href="/" variant="primary" className="shrink-0">View Public Website</Button>
      </Card>

      {/* Actionable Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                alert.type === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                  : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  alert.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  {alert.type === 'warning' ? <HiExclamationTriangle className="w-5 h-5" /> : <HiInformationCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{alert.label} ({alert.count})</h4>
                  <p className="text-slate-400 text-xs mt-0.5">{alert.message}</p>
                </div>
              </div>
              <Button href={alert.link} variant="secondary" className="py-1 px-3 text-[10px] h-auto shrink-0">
                {alert.linkText}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Database Warning */}
      {!dbConfigured && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6 space-y-5 shadow-lg shadow-amber-500/[0.01]">
          <div className="flex items-start gap-4">
            <HiExclamationTriangle className="w-7 h-7 mt-0.5 text-amber-400 shrink-0 animate-pulse" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-amber-400 tracking-tight">Database Connection Required</h3>
              <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
                To start registering teams and managing match scores, please update your database connection credentials. Configure your <code>DATABASE_URL</code> in your local <code>.env</code> file.
              </p>
              {connectionError && (
                <div className="text-xs text-amber-500 font-mono mt-3 bg-black/60 p-3 rounded-lg border border-amber-500/10">
                  <span className="font-bold text-amber-400">Error Details:</span> {connectionError}
                </div>
              )}
            </div>
          </div>

          <div className="pl-11 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Execute setup commands in your project shell:</h4>
            <div className="bg-[#04060a]/90 p-4 rounded-xl text-sm text-slate-300 font-mono space-y-2 border border-slate-900 shadow-inner">
              <p className="text-slate-500 text-xs"># 1. Push schema migrations to your Supabase Postgres database</p>
              <p><span className="text-slate-100 font-semibold">npm run</span> db:push</p>
              <p className="text-slate-500 text-xs"># 2. Seed with games, seasons, schools, and sample data</p>
              <p><span className="text-slate-100 font-semibold">npm run</span> db:seed</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/league">
          <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36 cursor-pointer">
            <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
              <span>Competition Games</span>
              <span className="p-1.5 bg-ez-pink/10 rounded-lg border border-ez-pink/20 text-ez-pink"><HiOutlineTrophy className="w-6 h-6" /></span>
            </div>
            <p className="text-4xl font-black text-white">{dbConfigured ? stats.games : 'N/A'}</p>
          </Card>
        </Link>

        <Link href="/admin/roster">
          <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36 cursor-pointer">
            <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
              <span>Registered Teams</span>
              <span className="p-1.5 bg-ez-pink/10 rounded-lg border border-ez-pink/20 text-ez-pink"><HiOutlineUsers className="w-6 h-6" /></span>
            </div>
            <p className="text-4xl font-black text-white">{dbConfigured ? stats.teams : 'N/A'}</p>
          </Card>
        </Link>

        <Link href="/admin/matches">
          <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36 cursor-pointer">
            <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
              <span>Scheduled Matches</span>
              <span className="p-1.5 bg-ez-pink/10 rounded-lg border border-ez-pink/20 text-ez-pink"><HiOutlineCalendarDays className="w-6 h-6" /></span>
            </div>
            <p className="text-4xl font-black text-white">{dbConfigured ? stats.scheduledMatches : 'N/A'}</p>
          </Card>
        </Link>

        <Link href="/admin/news">
          <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36 cursor-pointer">
            <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
              <span>Published Articles</span>
              <span className="p-1.5 bg-ez-pink/10 rounded-lg border border-ez-pink/20 text-ez-pink"><HiOutlineNewspaper className="w-6 h-6" /></span>
            </div>
            <p className="text-4xl font-black text-white">{dbConfigured ? stats.publishedNews : 'N/A'}</p>
          </Card>
        </Link>
      </div>

      {/* Quick Action Tasks */}
      <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
        <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider">Quick Administration Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a]/80 border border-zinc-800/80 p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-zinc-700 transition-all duration-300 group">
            <div>
              <h4 className="font-extrabold text-white group-hover:text-zinc-300 transition-colors">Create Match Event</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">Schedule new matches, input results, and manage varsity matchups.</p>
            </div>
            <Link
              href="/admin/matches"
              className="text-xs font-bold text-zinc-400 hover:text-ez-pink transition-colors uppercase tracking-wider"
            >
              Go to Match Manager →
            </Link>
          </div>

          <div className="bg-[#1a1a1a]/80 border border-zinc-800/80 p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-zinc-700 transition-all duration-300 group">
            <div>
              <h4 className="font-extrabold text-white group-hover:text-zinc-300 transition-colors">Write Announcement</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">Publish new blog posts, tournament notifications, and updates for clubs.</p>
            </div>
            <Link
              href="/admin/news"
              className="text-xs font-bold text-zinc-400 hover:text-ez-pink transition-colors uppercase tracking-wider"
            >
              Create News Article →
            </Link>
          </div>

          <div className="bg-[#1a1a1a]/80 border border-zinc-800/80 p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-zinc-700 transition-all duration-300 group">
            <div>
              <h4 className="font-extrabold text-white group-hover:text-zinc-300 transition-colors">Roster Management</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">Assign student captain roles, register roster lists, and edit player profiles.</p>
            </div>
            <Link
              href="/admin/roster"
              className="text-xs font-bold text-zinc-400 hover:text-ez-pink transition-colors uppercase tracking-wider"
            >
              Manage Roster Lists →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
