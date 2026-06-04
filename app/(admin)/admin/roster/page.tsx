import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createRosterMember, deleteRosterMember } from './actions';

export default async function AdminRosterPage() {
  let rostersList: typeof schema.rosters.$inferSelect[] = [];
  let teams: typeof schema.teams.$inferSelect[] = [];
  let games: typeof schema.games.$inferSelect[] = [];
  let dbError = false;

  try {
    rostersList = await db.select().from(schema.rosters);
    teams = await db.select().from(schema.teams);
    games = await db.select().from(schema.games);
  } catch {
    dbError = true;
  }

  // Maps
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">Roster Manager</h1>
        <p className="text-gray-400 text-xs mt-1">Register student players, assign captain roles, and modify bios for teams.</p>
      </div>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch roster configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Member Column */}
          <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-6 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Add Roster Member</h2>
              <p className="text-gray-400 text-xs mt-0.5">Register a player onto a team.</p>
            </div>

            <form action={createRosterMember} className="space-y-4">
              <div>
                <label htmlFor="teamId" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Assign Team
                </label>
                <select
                  id="teamId"
                  name="teamId"
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
                <label htmlFor="name" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Player Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Player Role
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Player">Player</option>
                  <option value="Captain">Captain</option>
                  <option value="Coach">Coach</option>
                  <option value="Sub">Substitute</option>
                </select>
              </div>

              <div>
                <label htmlFor="bio" className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Short Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  placeholder="e.g. Dual duelist main..."
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded shadow-lg transition-colors cursor-pointer"
              >
                Add Player
              </button>
            </form>
          </div>

          {/* Rosters List Column */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {rostersList.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                No roster members found. Add players using the left form panel!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Name / Bio</th>
                      <th className="px-6 py-4">Team</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-sm">
                    {rostersList.map((player) => {
                      const team = teamMap.get(player.teamId);
                      const game = team ? gameMap.get(team.gameId) : null;
                      const deleteActionWithId = deleteRosterMember.bind(null, player.id);

                      return (
                        <tr key={player.id} className="hover:bg-gray-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{player.name}</div>
                            <div className="text-xs text-gray-400 max-w-xs truncate mt-0.5">{player.bio || 'No bio provided.'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="block font-semibold text-white">{team?.name || 'Unknown'}</span>
                            <span className="block text-xs text-gray-400">{game?.shortName} • {team?.division}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${
                              player.role === 'Captain' 
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
                                : 'bg-gray-800 text-gray-300 border-gray-700'
                            }`}>
                              {player.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <form action={deleteActionWithId}>
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 font-semibold text-xs rounded transition-colors text-rose-400 border border-rose-950/30 cursor-pointer"
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
