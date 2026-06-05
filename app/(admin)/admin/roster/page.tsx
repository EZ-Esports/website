import { getCachedPlayers, getCachedRosters, getCachedTeams, getCachedGames } from '@/app/lib/db/queries';
import { 
  createRosterMember, 
  deleteRosterMember,
  createTeam,
  deleteTeam,
  createRoster,
  deleteRoster,
  updateRosterRecord
} from './actions';
import Card from '@/app/components/ui/Card';

export default async function AdminRosterPage() {
  let playersList: Awaited<ReturnType<typeof getCachedPlayers>> = [];
  let rosters: Awaited<ReturnType<typeof getCachedRosters>> = [];
  let teams: Awaited<ReturnType<typeof getCachedTeams>> = [];
  let games: Awaited<ReturnType<typeof getCachedGames>> = [];
  let dbError = false;

  try {
    const [playersRes, rostersRes, teamsRes, gamesRes] = await Promise.all([
      getCachedPlayers(),
      getCachedRosters(),
      getCachedTeams(),
      getCachedGames(),
    ]);
    playersList = playersRes;
    rosters = rostersRes;
    teams = teamsRes;
    games = gamesRes;
  } catch {
    dbError = true;
  }

  // Maps
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const gameMap = new Map(games.map((g) => [g.id, g]));
  
  // Groupings for tree display
  const teamsByGame = new Map<string, typeof teams>();
  teams.forEach((t) => {
    const arr = teamsByGame.get(t.gameId) || [];
    arr.push(t);
    teamsByGame.set(t.gameId, arr);
  });

  const rostersByTeam = new Map<string, typeof rosters>();
  rosters.forEach((r) => {
    const arr = rostersByTeam.get(r.teamId) || [];
    arr.push(r);
    rostersByTeam.set(r.teamId, arr);
  });

  const playersByRoster = new Map<string, typeof playersList>();
  playersList.forEach((p) => {
    const arr = playersByRoster.get(p.rosterId) || [];
    arr.push(p);
    playersByRoster.set(p.rosterId, arr);
  });

  const inputClass = "w-full px-3 py-2 bg-slate-950 border border-slate-800/80 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 transition-all text-xs";
  const btnClass = "w-full py-2 bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer";

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="hover:border-slate-800/80 hover:shadow-none duration-300">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Teams, Rosters & Players Manager</h1>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
          Create game teams, assign varsity/JV division rosters with records, and register player profiles.
        </p>
      </Card>

      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-lg">
          Failed to fetch database configurations. Please ensure database migrations have run.
        </div>
      )}

      {!dbError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Creation Forms Column */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Form 1: Create Team */}
            <Card className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">1. Register School Team</h2>
                <p className="text-slate-500 text-[10px] mt-0.5">Add a school to a game&apos;s competitive roster.</p>
              </div>

              <form action={createTeam} className="space-y-3.5">
                <div>
                  <label htmlFor="gameId" className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    Game
                  </label>
                  <select id="gameId" name="gameId" required className={inputClass}>
                    {games.map((g) => (
                      <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                        {g.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="teamName" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    School/Team Name
                  </label>
                  <input
                    id="teamName"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Bronx Science"
                    className={inputClass}
                  />
                </div>

                <button type="submit" className={btnClass}>
                  Register Team
                </button>
              </form>
            </Card>

            {/* Form 2: Create Roster */}
            <Card className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">2. Create Roster Squad</h2>
                <p className="text-slate-500 text-[10px] mt-0.5">Define a squad (e.g. Varsity/JV) under a team.</p>
              </div>

              <form action={createRoster} className="space-y-3.5">
                <div>
                  <label htmlFor="teamId" className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    Parent Team
                  </label>
                  <select id="teamId" name="teamId" required className={inputClass}>
                    {teams.map((t) => {
                      const game = gameMap.get(t.gameId);
                      return (
                        <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                          {t.name} - {game?.shortName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rosterName" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                      Roster Name
                    </label>
                    <input
                      id="rosterName"
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. Varsity"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="division" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                      Division
                    </label>
                    <select id="division" name="division" required className={inputClass}>
                      <option value="Varsity" className="bg-slate-900 text-white">Varsity</option>
                      <option value="JV" className="bg-slate-900 text-white">JV</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="wins" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                      Wins
                    </label>
                    <input
                      id="wins"
                      name="wins"
                      type="number"
                      defaultValue={0}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="losses" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                      Losses
                    </label>
                    <input
                      id="losses"
                      name="losses"
                      type="number"
                      defaultValue={0}
                      className={inputClass}
                    />
                  </div>
                </div>

                <button type="submit" className={btnClass}>
                  Create Roster
                </button>
              </form>
            </Card>

            {/* Form 3: Add Player */}
            <Card className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">3. Add Player Member</h2>
                <p className="text-slate-500 text-[10px] mt-0.5">Register a player onto a team roster.</p>
              </div>

              <form action={createRosterMember} className="space-y-3.5">
                <div>
                  <label htmlFor="rosterId" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    Target Roster
                  </label>
                  <select id="rosterId" name="rosterId" required className={inputClass}>
                    {rosters.map((r) => {
                      const team = teamMap.get(r.teamId);
                      const game = team ? gameMap.get(team.gameId) : null;
                      return (
                        <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                          {team?.name} ({r.division}) - {game?.shortName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor="playerName" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    Player Name
                  </label>
                  <input
                    id="playerName"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Alex Chen"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    Player Role
                  </label>
                  <select id="role" name="role" required className={inputClass}>
                    <option value="Player" className="bg-slate-900 text-white">Player</option>
                    <option value="Captain" className="bg-slate-900 text-white">Captain</option>
                    <option value="Coach" className="bg-slate-900 text-white">Coach</option>
                    <option value="Sub" className="bg-slate-900 text-white">Substitute</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bio" className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    Short Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={2}
                    placeholder="e.g. Controller main..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800/80 rounded-lg text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-ez-pink/50 transition-all leading-relaxed"
                  />
                </div>

                <button type="submit" className={btnClass}>
                  Register Player
                </button>
              </form>
            </Card>

          </div>

          {/* Nested Tree Explorer Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Explorer Hierarchy</h2>
                <p className="text-slate-400 text-xs mt-0.5">Browse games, teams, division rosters, and players.</p>
              </div>

              {games.length === 0 ? (
                <div className="text-center p-12 text-slate-550 text-sm">
                  No games registered. Seed the database to get started.
                </div>
              ) : (
                <div className="space-y-6">
                  {games.map((game) => {
                    const gameTeams = teamsByGame.get(game.id) || [];
                    return (
                      <div key={game.id} className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/10">
                        {/* Game Header */}
                        <div className="bg-[#0b101d] px-4 py-3 border-b border-slate-850 flex justify-between items-center">
                          <span className="font-extrabold text-white text-xs uppercase tracking-widest">{game.displayName}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{gameTeams.length} Teams</span>
                        </div>

                        {/* Teams */}
                        <div className="p-4 space-y-4 divide-y divide-slate-850/50">
                          {gameTeams.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">No teams registered under this game.</p>
                          ) : (
                            gameTeams.map((team) => {
                              const teamRosters = rostersByTeam.get(team.id) || [];
                              const deleteTeamAction = deleteTeam.bind(null, team.id);

                              return (
                                <div key={team.id} className="pt-3 first:pt-0 space-y-3">
                                  {/* Team info */}
                                  <div className="flex justify-between items-center pl-1">
                                    <h3 className="font-bold text-slate-100 text-sm tracking-tight">{team.name}</h3>
                                    <form action={deleteTeamAction}>
                                      <button type="submit" className="text-[10px] font-bold text-slate-450 hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer">
                                        Delete Team
                                      </button>
                                    </form>
                                  </div>

                                  {/* Rosters */}
                                  <div className="pl-4 space-y-3">
                                    {teamRosters.length === 0 ? (
                                      <p className="text-[11px] text-slate-500 italic">No rosters created for this team.</p>
                                    ) : (
                                      teamRosters.map((roster) => {
                                        const rosterPlayers = playersByRoster.get(roster.id) || [];
                                        const deleteRosterAction = deleteRoster.bind(null, roster.id);
                                        const updateRecordAction = updateRosterRecord.bind(null, roster.id);

                                        return (
                                          <div key={roster.id} className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 space-y-3">
                                            {/* Roster header/edit record */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-2">
                                              <span className="font-bold text-xs text-slate-300 uppercase tracking-wider">
                                                {roster.name} ({roster.division})
                                              </span>

                                              {/* Edit Record form */}
                                              <form action={updateRecordAction} className="flex items-center gap-2">
                                                <input
                                                  name="wins"
                                                  type="number"
                                                  defaultValue={roster.wins}
                                                  className="w-10 h-6 bg-slate-950 border border-slate-800 rounded text-center text-white text-[11px] font-bold"
                                                />
                                                <span className="text-[10px] text-slate-500 font-bold uppercase select-none">W</span>
                                                <input
                                                  name="losses"
                                                  type="number"
                                                  defaultValue={roster.losses}
                                                  className="w-10 h-6 bg-slate-950 border border-slate-800 rounded text-center text-white text-[11px] font-bold"
                                                />
                                                <span className="text-[10px] text-slate-500 font-bold uppercase select-none">L</span>
                                                <button type="submit" className="px-2 py-0.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-[10px] text-slate-300 font-bold uppercase tracking-wider rounded transition-colors cursor-pointer">
                                                  Save
                                                </button>
                                              </form>

                                              <form action={deleteRosterAction}>
                                                <button type="submit" className="text-[10px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer">
                                                  Delete Roster
                                                </button>
                                              </form>
                                            </div>

                                            {/* Players */}
                                            <div className="space-y-1.5 pl-1">
                                              {rosterPlayers.length === 0 ? (
                                                <p className="text-[10px] text-slate-550 italic">No players registered.</p>
                                              ) : (
                                                rosterPlayers.map((player) => {
                                                  const deletePlayerAction = deleteRosterMember.bind(null, player.id);
                                                  return (
                                                    <div key={player.id} className="flex items-center justify-between py-1 bg-slate-950/20 px-2 rounded hover:bg-slate-900/10 transition-colors">
                                                      <div>
                                                        <span className="font-semibold text-slate-200 text-xs">{player.name}</span>
                                                        <span className="text-[9px] bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded text-slate-400 uppercase tracking-wider font-semibold ml-2">
                                                          {player.role}
                                                        </span>
                                                      </div>
                                                      <form action={deletePlayerAction}>
                                                        <button type="submit" className="text-[10px] text-slate-450 hover:text-red-400 font-bold uppercase transition-colors cursor-pointer">
                                                          Remove
                                                        </button>
                                                      </form>
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
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
