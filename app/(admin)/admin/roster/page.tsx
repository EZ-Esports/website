import { getCachedRosters, getCachedTeams, getCachedGames } from '@/app/lib/db/queries';
import { createRosterMember, deleteRosterMember } from './actions';
import Card from '@/app/components/ui/Card';

export default async function AdminRosterPage() {
  let rostersList: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let dbError = false;

  try {
    const [rostersRes, teamsRes, gamesRes] = await Promise.all([
      getCachedRosters(),
      getCachedTeams(),
      getCachedGames(),
    ]);
    rostersList = rostersRes;
    teams = teamsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  // Maps
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const inputClass = "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all text-sm";

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Roster Manager</h1>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Register student players, assign captain roles, and manage bio notes displayed in team rosters.
        </p>
      </Card>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch roster configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Member Column */}
          <Card className="lg:col-span-1 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Add Roster Member</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">Register a player onto a team.</p>
            </div>

            <form action={createRosterMember} className="space-y-5">
              <div>
                <label htmlFor="teamId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Assign Team
                </label>
                <select
                  id="teamId"
                  name="teamId"
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
                <label htmlFor="name" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Player Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Player Role
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  className={inputClass}
                >
                  <option value="Player" className="bg-slate-900 text-white">Player</option>
                  <option value="Captain" className="bg-slate-900 text-white">Captain</option>
                  <option value="Coach" className="bg-slate-900 text-white">Coach</option>
                  <option value="Sub" className="bg-slate-900 text-white">Substitute</option>
                </select>
              </div>

              <div>
                <label htmlFor="bio" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Short Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  placeholder="e.g. Dual duelist main..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all text-sm leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-white hover:bg-slate-200 text-slate-950 text-sm font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Add Player
              </button>
            </form>
          </Card>

          {/* Rosters List Column */}
          <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {rostersList.length === 0 ? (
              <div className="p-16 text-center text-slate-500 text-sm bg-slate-950/20 rounded-2xl">
                No roster members found. Add players using the left form panel!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0b101d] border-b border-slate-800/80">
                    <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                      <th className="px-6 py-4">Name / Bio</th>
                      <th className="px-6 py-4">Team</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {rostersList.map((player) => {
                      const team = teamMap.get(player.teamId);
                      const game = team ? gameMap.get(team.gameId) : null;
                      const deleteActionWithId = deleteRosterMember.bind(null, player.id);

                      return (
                        <tr key={player.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-base tracking-tight">{player.name}</div>
                            <div className="text-xs text-slate-400 max-w-xs truncate mt-1 leading-relaxed">
                              {player.bio || 'No bio provided.'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="block font-bold text-white tracking-tight">{team?.name || 'Unknown'}</span>
                            <span className="block text-xs text-slate-400 font-semibold mt-0.5">
                              {game?.shortName} • {team?.division} Division
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded border ${
                              player.role === 'Captain' 
                                ? 'bg-white/10 text-white border-white/20' 
                                : 'bg-slate-950/40 text-slate-400 border-slate-800/80'
                            }`}>
                              {player.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <form action={deleteActionWithId}>
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
                              >
                                Remove
                              </button>
                            </form>
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
      )}
    </div>
  );
}
