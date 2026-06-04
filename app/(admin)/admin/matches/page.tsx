import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { createMatch, updateMatchScore, deleteMatch } from './actions';

export default async function AdminMatchesPage() {
  let matches: typeof schema.matches.$inferSelect[] = [];
  let teams: typeof schema.teams.$inferSelect[] = [];
  let seasons: typeof schema.seasons.$inferSelect[] = [];
  let games: typeof schema.games.$inferSelect[] = [];
  let dbError = false;

  try {
    matches = await db.select().from(schema.matches).orderBy(desc(schema.matches.scheduledAt));
    teams = await db.select().from(schema.teams);
    seasons = await db.select().from(schema.seasons).where(eq(schema.seasons.isActive, true));
    games = await db.select().from(schema.games);
  } catch {
    dbError = true;
  }

  // Build maps for fast lookups
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const seasonMap = new Map(seasons.map((s) => [s.id, s]));
  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">Matches & Standings Manager</h1>
        <p className="text-gray-400 text-xs mt-1">Schedule new matchups and input scores to recalculate team win/loss ratios.</p>
      </div>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch match configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Scheduling Column */}
          <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-6 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Schedule New Match</h2>
              <p className="text-gray-400 text-xs mt-0.5">Register a new scheduled event.</p>
            </div>

            <form action={createMatch} className="space-y-4">
              <div>
                <label htmlFor="seasonId" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Active Season
                </label>
                <select
                  id="seasonId"
                  name="seasonId"
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {seasons.map((s) => {
                    const game = gameMap.get(s.gameId);
                    return (
                      <option key={s.id} value={s.id}>
                        {game?.displayName || 'Game'} - {s.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="homeTeamId" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Home Team
                </label>
                <select
                  id="homeTeamId"
                  name="homeTeamId"
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {teams.map((t) => {
                    const game = gameMap.get(t.gameId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.division}) - {game?.shortName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="awayTeamId" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Away Team
                </label>
                <select
                  id="awayTeamId"
                  name="awayTeamId"
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {teams.map((t) => {
                    const game = gameMap.get(t.gameId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.division}) - {game?.shortName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="scheduledAt" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Date & Time
                </label>
                <input
                  id="scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded shadow-lg transition-colors cursor-pointer"
              >
                Schedule Match
              </button>
            </form>
          </div>

          {/* Matches List Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Match Fixtures</h2>

              {matches.length === 0 ? (
                <div className="text-center p-8 text-gray-500 text-sm">No match fixtures scheduled yet.</div>
              ) : (
                <div className="space-y-4">
                  {matches.map((match) => {
                    const homeTeam = teamMap.get(match.homeTeamId);
                    const awayTeam = teamMap.get(match.awayTeamId);
                    const season = seasonMap.get(match.seasonId);
                    const game = season ? gameMap.get(season.gameId) : null;
                    const deleteActionWithId = deleteMatch.bind(null, match.id);
                    const updateActionWithId = updateMatchScore.bind(null, match.id);

                    return (
                      <div key={match.id} className="bg-gray-950 border border-gray-800 rounded-lg p-5 space-y-4">
                        {/* Meta */}
                        <div className="flex justify-between items-center text-xs text-gray-400">
                          <span className="font-semibold text-rose-300">
                            {game?.displayName} • {season?.name}
                          </span>
                          <span>
                            {new Date(match.scheduledAt).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Match UI & Inputs */}
                        <form action={updateActionWithId} className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-[240px]">
                            {/* Home */}
                            <div className="text-right flex-1">
                              <span className="block text-sm font-semibold text-white">{homeTeam?.name || 'Home Team'}</span>
                              <span className="text-xs text-gray-400">{homeTeam?.division}</span>
                            </div>

                            {/* Score Input Fields */}
                            <div className="flex items-center gap-2">
                              <input
                                name="homeScore"
                                type="number"
                                min={0}
                                defaultValue={match.homeScore ?? ''}
                                className="w-12 h-10 bg-gray-900 border border-gray-800 rounded text-center text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                                placeholder="-"
                              />
                              <span className="text-gray-500 font-bold">vs</span>
                              <input
                                name="awayScore"
                                type="number"
                                min={0}
                                defaultValue={match.awayScore ?? ''}
                                className="w-12 h-10 bg-gray-900 border border-gray-800 rounded text-center text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                                placeholder="-"
                              />
                            </div>

                            {/* Away */}
                            <div className="text-left flex-1">
                              <span className="block text-sm font-semibold text-white">{awayTeam?.name || 'Away Team'}</span>
                              <span className="text-xs text-gray-400">{awayTeam?.division}</span>
                            </div>
                          </div>

                          {/* Status and Action Buttons */}
                          <div className="flex items-center gap-3">
                            <select
                              name="status"
                              defaultValue={match.status}
                              className="px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="live">Live</option>
                              <option value="completed">Completed</option>
                            </select>

                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 font-semibold text-xs rounded text-gray-300 border border-gray-700 transition-colors cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </form>

                        {/* Footer Deletion */}
                        <div className="flex justify-end pt-3 border-t border-gray-800">
                          <form action={deleteActionWithId}>
                            <button
                              type="submit"
                              className="text-xs text-rose-400/70 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              Delete Fixture
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
