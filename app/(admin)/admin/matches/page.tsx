import { getCachedMatches, getCachedTeams, getCachedSeasons, getCachedGames } from '@/app/lib/db/queries';
import { createMatch, updateMatchScore, deleteMatch } from './actions';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

export default async function AdminMatchesPage() {
  let matches: Awaited<ReturnType<typeof getCachedMatches>> = [];
  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let seasons: Awaited<ReturnType<typeof getCachedSeasons>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let dbError = false;

  try {
    const [matchesRes, teamsRes, seasonsRes, gamesRes] = await Promise.all([
      getCachedMatches(),
      getCachedTeams(),
      getCachedSeasons(),
      getCachedGames(),
    ]);
    matches = matchesRes;
    teams = teamsRes;
    seasons = seasonsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  // Build maps for fast lookups
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const seasonMap = new Map(seasons.map((s) => [s.id, s]));
  const gameMap = new Map(games.map((g) => [g.id, g]));

  const inputClass = "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all";

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Matches & Standings Manager</h1>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Schedule new matches and update final scores to automatically calculate team standings and seasonal records.
        </p>
      </Card>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch match configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Scheduling Column */}
          <Card className="lg:col-span-1 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Schedule Match</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">Register a new match event for the season.</p>
            </div>

            <form action={createMatch} className="space-y-5">
              <div>
                <label htmlFor="seasonId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Active Season
                </label>
                <select
                  id="seasonId"
                  name="seasonId"
                  required
                  className={inputClass}
                >
                  {seasons.map((s) => {
                    const game = gameMap.get(s.gameId);
                    return (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                        {game?.displayName || 'Game'} - {s.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="homeTeamId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Home Team
                </label>
                <select
                  id="homeTeamId"
                  name="homeTeamId"
                  required
                  className={inputClass}
                >
                  {teams.map((t) => {
                    const game = gameMap.get(t.gameId);
                    return (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name} ({t.division}) - {game?.shortName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="awayTeamId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Away Team
                </label>
                <select
                  id="awayTeamId"
                  name="awayTeamId"
                  required
                  className={inputClass}
                >
                  {teams.map((t) => {
                    const game = gameMap.get(t.gameId);
                    return (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name} ({t.division}) - {game?.shortName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="scheduledAt" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Date & Time
                </label>
                <input
                  id="scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-ez-pink to-ez-purple text-white text-sm font-bold uppercase tracking-wider rounded-lg hover:brightness-110 shadow-lg shadow-ez-pink/15 transition-all cursor-pointer"
              >
                Schedule Match
              </button>
            </form>
          </Card>

          {/* Matches List Column */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
              <h2 className="text-lg font-black text-white mb-6 uppercase tracking-wider">Match Fixtures</h2>

              {matches.length === 0 ? (
                <div className="text-center p-12 text-slate-500 text-sm bg-slate-950/20 border border-slate-900 rounded-xl">
                  No match fixtures scheduled yet.
                </div>
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
                      <div 
                        key={match.id} 
                        className="bg-[#0b0f19]/40 border border-slate-800/80 rounded-xl p-5 space-y-4 hover:border-slate-700/60 transition-colors"
                      >
                        {/* Meta */}
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-ez-pink uppercase tracking-widest">
                            {game?.displayName} • {season?.name}
                          </span>
                          <span className="text-slate-400 font-semibold">
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
                              <span className="block text-sm font-bold text-white tracking-tight">{homeTeam?.name || 'Home Team'}</span>
                              <span className="text-xs text-slate-400 font-medium">{homeTeam?.division} Division</span>
                            </div>

                            {/* Score Input Fields */}
                            <div className="flex items-center gap-2">
                              <input
                                name="homeScore"
                                type="number"
                                min={0}
                                defaultValue={match.homeScore ?? ''}
                                className="w-12 h-10 bg-slate-950 border border-slate-800 rounded-lg text-center text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 text-sm font-bold"
                                placeholder="-"
                              />
                              <span className="text-slate-500 font-black text-sm uppercase">vs</span>
                              <input
                                name="awayScore"
                                type="number"
                                min={0}
                                defaultValue={match.awayScore ?? ''}
                                className="w-12 h-10 bg-slate-950 border border-slate-800 rounded-lg text-center text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 text-sm font-bold"
                                placeholder="-"
                              />
                            </div>

                            {/* Away */}
                            <div className="text-left flex-1">
                              <span className="block text-sm font-bold text-white tracking-tight">{awayTeam?.name || 'Away Team'}</span>
                              <span className="text-xs text-slate-400 font-medium">{awayTeam?.division} Division</span>
                            </div>
                          </div>

                          {/* Status and Action Buttons */}
                          <div className="flex items-center gap-2">
                            <select
                              name="status"
                              defaultValue={match.status}
                              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800/80 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 cursor-pointer"
                            >
                              <option value="scheduled" className="bg-slate-900 text-white">Scheduled</option>
                              <option value="live" className="bg-slate-900 text-white">Live</option>
                              <option value="completed" className="bg-slate-900 text-white">Completed</option>
                            </select>

                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </form>

                        {/* Footer Deletion */}
                        <div className="flex justify-end pt-3 border-t border-slate-900">
                          <form action={deleteActionWithId}>
                            <button
                              type="submit"
                              className="text-[10px] font-bold text-slate-500 hover:text-ez-pink uppercase tracking-widest transition-colors cursor-pointer"
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
            </Card>
          </div>
          
        </div>
      )}
    </div>
  );
}
