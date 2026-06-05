import { getCachedGames, getCachedTeams, getCachedMatches, getCachedNews } from '@/app/lib/db/queries';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

export default async function AdminDashboardPage() {
  let stats = { games: 0, teams: 0, matches: 0, news: 0 };
  let dbConfigured = false;
  let connectionError = '';

  try {
    if (process.env.DATABASE_URL) {
      const [games, teams, matches, news] = await Promise.all([
        getCachedGames(),
        getCachedTeams(),
        getCachedMatches(),
        getCachedNews(),
      ]);

      stats = {
        games: games.length,
        teams: teams.length,
        matches: matches.length,
        news: news.length,
      };
      dbConfigured = true;
    }
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Database connection error';
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <Card className="bg-slate-900/30 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-none duration-300">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Welcome to EZ CMS</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed max-w-xl">
            Manage public competition schedules, teams, roster lists, and news announcements from a single, unified database dashboard.
          </p>
        </div>
        <Link href="/" className="shrink-0">
          <Button variant="primary">View Public Website</Button>
        </Link>
      </Card>

      {/* Database Warning */}
      {!dbConfigured && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6 space-y-5 shadow-lg shadow-amber-500/[0.01]">
          <div className="flex items-start gap-4">
            <span className="text-3xl mt-0.5 select-none animate-pulse">⚠️</span>
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
              <p className="text-slate-500 text-xs"># 1. Stash changes & push migrations to Supabase Postgres</p>
              <p><span className="text-slate-100 font-semibold">npm run</span> db:push</p>
              <p className="text-slate-500 text-xs"># 2. Seed database with games, teams, and sample match fixtures</p>
              <p><span className="text-slate-100 font-semibold">npm run</span> db:seed</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36">
          <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
            <span>Competition Games</span>
            <span className="text-2xl p-1.5 bg-slate-900 rounded-lg border border-slate-800">🎮</span>
          </div>
          <p className="text-4xl font-black text-white">{dbConfigured ? stats.games : '--'}</p>
        </Card>

        <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36">
          <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
            <span>Registered Teams</span>
            <span className="text-2xl p-1.5 bg-slate-900 rounded-lg border border-slate-800">👥</span>
          </div>
          <p className="text-4xl font-black text-white">{dbConfigured ? stats.teams : '--'}</p>
        </Card>

        <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36">
          <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
            <span>Scheduled Matches</span>
            <span className="text-2xl p-1.5 bg-slate-900 rounded-lg border border-slate-800">🏆</span>
          </div>
          <p className="text-4xl font-black text-white">{dbConfigured ? stats.matches : '--'}</p>
        </Card>

        <Card className="hover:scale-[1.03] duration-300 flex flex-col justify-between h-36">
          <div className="flex justify-between items-center text-slate-400 text-sm font-bold uppercase tracking-wider">
            <span>Published Articles</span>
            <span className="text-2xl p-1.5 bg-slate-900 rounded-lg border border-slate-800">📰</span>
          </div>
          <p className="text-4xl font-black text-white">{dbConfigured ? stats.news : '--'}</p>
        </Card>
      </div>

      {/* Quick Action Tasks */}
      <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
        <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider">Quick Administration Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0b0f19]/80 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-slate-700 transition-all duration-300 group">
            <div>
              <h4 className="font-extrabold text-white group-hover:text-slate-350 transition-colors">Create Match Event</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">Schedule new matches, input results, and manage varsity matchups.</p>
            </div>
            <Link
              href="/admin/matches"
              className="text-xs font-bold text-slate-350 hover:text-white hover:underline uppercase tracking-wider"
            >
              Go to Match Manager →
            </Link>
          </div>

          <div className="bg-[#0b0f19]/80 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-slate-700 transition-all duration-300 group">
            <div>
              <h4 className="font-extrabold text-white group-hover:text-slate-350 transition-colors">Write Announcement</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">Publish new blog posts, tournament notifications, and updates for clubs.</p>
            </div>
            <Link
              href="/admin/news"
              className="text-xs font-bold text-slate-350 hover:text-white hover:underline uppercase tracking-wider"
            >
              Create News Article →
            </Link>
          </div>

          <div className="bg-[#0b0f19]/80 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-slate-700 transition-all duration-300 group">
            <div>
              <h4 className="font-extrabold text-white group-hover:text-slate-350 transition-colors">Roster Management</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">Assign student captain roles, register roster lists, and edit player profiles.</p>
            </div>
            <Link
              href="/admin/roster"
              className="text-xs font-bold text-slate-350 hover:text-white hover:underline uppercase tracking-wider"
            >
              Manage Roster Lists →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
