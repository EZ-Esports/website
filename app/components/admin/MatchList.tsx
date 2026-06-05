'use client';

import { useState, useMemo } from 'react';
import { updateMatchScore, deleteMatch } from '@/app/(admin)/admin/matches/actions';

interface Match {
  id: string;
  seasonId: string;
  homeRosterId: string;
  awayRosterId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: Date;
}

interface Season {
  id: string;
  name: string;
  gameId: string;
}

interface Roster {
  id: string;
  teamId: string;
  division: string;
}

interface Team {
  id: string;
  name: string;
}

interface Game {
  id: string;
  shortName: string;
}

interface MatchListProps {
  initialMatches: Match[];
  seasons: Season[];
  rosters: Roster[];
  teams: Team[];
  games: Game[];
}

export default function MatchList({ initialMatches, seasons, rosters, teams, games }: MatchListProps) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const rosterMap = useMemo(() => new Map(rosters.map(r => [r.id, r])), [rosters]);
  const seasonMap = useMemo(() => new Map(seasons.map(s => [s.id, s])), [seasons]);
  const gameMap = useMemo(() => new Map(games.map(g => [g.id, g])), [games]);

  const filteredMatches = useMemo(() => {
    return initialMatches.filter(match => {
      const homeRoster = rosterMap.get(match.homeRosterId);
      const awayRoster = rosterMap.get(match.awayRosterId);
      const homeTeam = homeRoster ? teamMap.get(homeRoster.teamId) : null;
      const awayTeam = awayRoster ? teamMap.get(awayRoster.teamId) : null;
      const season = seasonMap.get(match.seasonId);
      const game = season ? gameMap.get(season.gameId) : null;

      const searchStr = `${homeTeam?.name} ${awayTeam?.name} ${game?.shortName} ${season?.name}`.toLowerCase();
      const matchesSearch = filter === '' || searchStr.includes(filter.toLowerCase());
      const matchesStatus = statusFilter === 'all' || match.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [initialMatches, filter, statusFilter, rosterMap, teamMap, seasonMap, gameMap]);

  return (
    <div className="bg-[#0d1321]/60 border border-slate-900 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
      <div className="px-6 py-5 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-base font-bold text-white uppercase tracking-wider">Match Fixtures</h2>
        
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Search teams or games..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 w-full sm:w-48"
          />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center p-12 text-slate-500 text-sm">
          {initialMatches.length === 0 ? 'No match fixtures scheduled yet.' : 'No matches match your filters.'}
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
            <tbody className="divide-y divide-slate-800 text-sm">
              {filteredMatches.map((match) => {
                const homeRoster = rosterMap.get(match.homeRosterId);
                const awayRoster = rosterMap.get(match.awayRosterId);
                const homeTeam = homeRoster ? teamMap.get(homeRoster.teamId) : null;
                const awayTeam = awayRoster ? teamMap.get(awayRoster.teamId) : null;
                const season = seasonMap.get(match.seasonId);
                const game = season ? gameMap.get(season.gameId) : null;
                
                const updateActionWithId = updateMatchScore.bind(null, match.id);
                const deleteActionWithId = deleteMatch.bind(null, match.id);

                return (
                  <tr key={match.id} className="hover:bg-slate-800/10 transition-colors">
                    {/* Season & Date */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                        {game?.shortName} • {season?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                         {new Date(match.scheduledAt).toLocaleDateString('en-US', {
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
                        <div className="text-right w-28 truncate">
                          <span className="block font-semibold text-white text-sm">{homeTeam?.name || 'Home'}</span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{homeRoster?.division}</span>
                        </div>

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

                        <div className="text-left w-28 truncate">
                          <span className="block font-semibold text-white text-sm">{awayTeam?.name || 'Away'}</span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{awayRoster?.division}</span>
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
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded text-slate-300 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                        >
                          Save
                        </button>
                        <form action={deleteActionWithId} className="inline-block">
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
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
  );
}
