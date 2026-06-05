import { getCachedMatches, getCachedTeams, getCachedSeasons, getCachedGames } from '@/app/lib/db/queries';
import { createMatch, updateMatchScore, deleteMatch } from './actions';
import Card from '@/app/components/ui/Card';

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

  const inputClass = "w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 transition-all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="hover:shadow-none duration-300">
        <h1 className="text-xl font-bold text-white uppercase tracking-wider">Matches & Standings Manager</h1>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
          Schedule matches and input scores to recalculate team standings and seasonal records.
        </p>
      </Card>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch match configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Scheduling Column */}
          <Card className="lg:col-span-1 h-fit space-y-5">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Schedule Match</h2>
              <p className="text-slate-400 text-xs mt-0.5">Register a new scheduled event.</p>
            </div>

            <form action={createMatch} className="space-y-4">
              <div>
                <label htmlFor="seasonId" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-1.5">
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
                <label htmlFor="homeTeamId" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-1.5">
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
                <label htmlFor="awayTeamId" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-1.5">
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
                <label htmlFor="scheduledAt" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-1.5">
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
                className="w-full py-2.5 bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Schedule Match
              </button>
            </form>
          </Card>

          {/* Matches List Column */}
          <div className="lg:col-span-2">
            <div className="bg-[#0d1321]/60 border border-slate-900 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
              <div className="px-6 py-5 border-b border-slate-900">
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Match Fixtures</h2>
              </div>

              {matches.length === 0 ? (
                <div className="text-center p-12 text-slate-500 text-sm">
                  No match fixtures scheduled yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#0b101d] border-b border-slate-900 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Season / Date</th>
                        <th className="px-6 py-4 text-center">Matchup & Scores</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-sm">
                      {matches.map((match) => {
                        const homeTeam = teamMap.get(match.homeTeamId);
                        const awayTeam = teamMap.get(match.awayTeamId);
                        const season = seasonMap.get(match.seasonId);
                        const game = season ? gameMap.get(season.gameId) : null;
                        const deleteActionWithId = deleteMatch.bind(null, match.id);
                        const updateActionWithId = updateMatchScore.bind(null, match.id);

                        return (
                          <tr key={match.id} className="hover:bg-slate-800/10 transition-colors">
                            {/* Season & Date */}
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                                {game?.shortName} • {season?.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                 {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                                   timeZone: 'America/New_York',
                                   month: 'short',
                                   day: 'numeric',
                                   hour: 'numeric',
                                   minute: '2-digit',
                                 })}
                              </div>
                            </td>

                            {/* Matchup & Score Inputs */}
                            <td className="px-6 py-4">
                              <form id={`form-${match.id}`} action={updateActionWithId} className="flex items-center justify-center gap-3">
                                {/* Home Team */}
                                <div className="text-right w-28 truncate">
                                  <span className="block font-semibold text-white text-sm">{homeTeam?.name || 'Home'}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{homeTeam?.division}</span>
                                </div>

                                {/* Score Inputs */}
                                <div className="flex items-center gap-1">
                                  <input
                                    name="homeScore"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={match.homeScore ?? ''}
                                    className="w-10 h-8 bg-slate-950 border border-slate-800 rounded text-center text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 text-xs font-bold"
                                    placeholder="-"
                                  />
                                  <span className="text-slate-600 text-[10px] font-bold uppercase select-none">vs</span>
                                  <input
                                    name="awayScore"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={match.awayScore ?? ''}
                                    className="w-10 h-8 bg-slate-950 border border-slate-800 rounded text-center text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 text-xs font-bold"
                                    placeholder="-"
                                  />
                                </div>

                                {/* Away Team */}
                                <div className="text-left w-28 truncate">
                                  <span className="block font-semibold text-white text-sm">{awayTeam?.name || 'Away'}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{awayTeam?.division}</span>
                                </div>
                              </form>
                            </td>

                            {/* Status dropdown */}
                            <td className="px-6 py-4">
                              <select
                                name="status"
                                form={`form-${match.id}`}
                                defaultValue={match.status}
                                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-ez-pink/50 cursor-pointer font-medium"
                              >
                                <option value="scheduled" className="bg-slate-900 text-white">Scheduled</option>
                                <option value="live" className="bg-slate-900 text-white">Live</option>
                                <option value="completed" className="bg-slate-900 text-white">Completed</option>
                              </select>
                            </td>

                            {/* Action Buttons */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="submit"
                                  form={`form-${match.id}`}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 font-bold text-xs uppercase tracking-wider rounded text-slate-300 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                                >
                                  Save
                                </button>
                                <form action={deleteActionWithId} className="inline-block">
                                  <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
