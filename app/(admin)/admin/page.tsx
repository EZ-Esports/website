import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { count } from 'drizzle-orm';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  let stats = { games: 0, teams: 0, matches: 0, news: 0 };
  let dbConfigured = false;
  let connectionError = '';

  try {
    if (process.env.DATABASE_URL) {
      const gamesCount = await db.select({ val: count() }).from(schema.games);
      const teamsCount = await db.select({ val: count() }).from(schema.teams);
      const matchesCount = await db.select({ val: count() }).from(schema.matches);
      const newsCount = await db.select({ val: count() }).from(schema.newsPosts);

      stats = {
        games: gamesCount[0]?.val || 0,
        teams: teamsCount[0]?.val || 0,
        matches: matchesCount[0]?.val || 0,
        news: newsCount[0]?.val || 0,
      };
      dbConfigured = true;
    }
  } catch (error) {
    connectionError = error instanceof Error ? error.message : 'Database connection error';
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-rose-950/20 to-gray-900 border border-rose-900/10 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome to EZ CMS</h1>
          <p className="text-gray-400 text-sm mt-1">Manage public configurations, schedule rosters, and news entries from one place.</p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 font-semibold text-sm rounded-lg shadow-lg hover:shadow-rose-600/10 transition-colors"
        >
          View Public Website
        </Link>
      </div>

      {/* Database Warning */}
      {!dbConfigured && (
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-amber-300">Database Connection Required</h3>
              <p className="text-gray-300 text-sm mt-1">
                To start saving data and viewing dynamic statistics, please configure your <code>DATABASE_URL</code> in your local <code>.env</code> file.
              </p>
              {connectionError && (
                <p className="text-xs text-amber-400 font-mono mt-2 bg-black/40 p-2 rounded border border-amber-900/20">
                  Error Details: {connectionError}
                </p>
              )}
            </div>
          </div>
          
          <div className="pl-9 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Run the following commands in your shell to complete setup:</h4>
            <div className="bg-gray-950 p-4 rounded-lg text-sm text-gray-300 font-mono space-y-1.5 border border-gray-900">
              <p className="text-gray-500"># 1. Update your .env file with your database password</p>
              <p className="text-gray-500"># 2. Push the schema to your Supabase Postgres database</p>
              <p><span className="text-rose-400">npm run</span> db:push</p>
              <p className="text-gray-500"># 3. Seed your database with games, teams, and sample match data</p>
              <p><span className="text-rose-400">npm run</span> db:seed</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <div className="flex justify-between items-center text-gray-400 text-sm">
            <span>Competition Games</span>
            <span className="text-xl">🎮</span>
          </div>
          <p className="text-3xl font-extrabold text-white">{dbConfigured ? stats.games : '--'}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <div className="flex justify-between items-center text-gray-400 text-sm">
            <span>Registered Teams</span>
            <span className="text-xl">👥</span>
          </div>
          <p className="text-3xl font-extrabold text-white">{dbConfigured ? stats.teams : '--'}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <div className="flex justify-between items-center text-gray-400 text-sm">
            <span>Scheduled Matches</span>
            <span className="text-xl">🏆</span>
          </div>
          <p className="text-3xl font-extrabold text-white">{dbConfigured ? stats.matches : '--'}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <div className="flex justify-between items-center text-gray-400 text-sm">
            <span>Published Articles</span>
            <span className="text-xl">📰</span>
          </div>
          <p className="text-3xl font-extrabold text-white">{dbConfigured ? stats.news : '--'}</p>
        </div>
      </div>

      {/* Quick Action Tasks */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Quick Administration Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-950 border border-gray-800 p-5 rounded-lg flex flex-col justify-between items-start gap-4">
            <div>
              <h4 className="font-semibold text-white">Create Match Event</h4>
              <p className="text-xs text-gray-400 mt-1">Schedule matches, assign scores, and manage varsity matchups.</p>
            </div>
            <Link
              href="/admin/matches"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
            >
              Go to Match Manager →
            </Link>
          </div>

          <div className="bg-gray-950 border border-gray-800 p-5 rounded-lg flex flex-col justify-between items-start gap-4">
            <div>
              <h4 className="font-semibold text-white">Write Announcement</h4>
              <p className="text-xs text-gray-400 mt-1">Publish news posts, tournament details, and notices for clubs.</p>
            </div>
            <Link
              href="/admin/news"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
            >
              Create News Article →
            </Link>
          </div>

          <div className="bg-gray-950 border border-gray-800 p-5 rounded-lg flex flex-col justify-between items-start gap-4">
            <div>
              <h4 className="font-semibold text-white">Roster Management</h4>
              <p className="text-xs text-gray-400 mt-1">Assign captain roles, edit bios, and register roster members.</p>
            </div>
            <Link
              href="/admin/roster"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
            >
              Manage Roster Lists →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
