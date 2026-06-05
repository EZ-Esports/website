'use client';

import { useState, useMemo } from 'react';
import { createMatch } from '@/app/(admin)/admin/matches/actions';

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
  gameId: string;
}

interface Game {
  id: string;
  displayName: string;
  shortName: string;
}

interface MatchScheduleFormProps {
  seasons: Season[];
  rosters: Roster[];
  teams: Team[];
  games: Game[];
}

export default function MatchScheduleForm({ seasons, rosters, teams, games }: MatchScheduleFormProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(seasons[0]?.id || '');
  
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const gameMap = useMemo(() => new Map(games.map(g => [g.id, g])), [games]);
  const seasonMap = useMemo(() => new Map(seasons.map(s => [s.id, s])), [seasons]);

  const selectedSeason = seasonMap.get(selectedSeasonId);
  const selectedGameId = selectedSeason?.gameId;

  // Filter rosters based on the selected season's game
  const filteredRosters = useMemo(() => {
    if (!selectedGameId) return rosters;
    return rosters.filter(r => {
      const team = teamMap.get(r.teamId);
      return team?.gameId === selectedGameId;
    });
  }, [rosters, selectedGameId, teamMap]);

  const inputClass = "w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-ez-pink/50 transition-all";

  return (
    <form action={createMatch} className="space-y-4">
      <div>
        <label htmlFor="seasonId" className="block text-xs font-bold text-slate-455 uppercase tracking-wider mb-1.5">
          Active Season
        </label>
        <select
          id="seasonId"
          name="seasonId"
          required
          value={selectedSeasonId}
          onChange={(e) => setSelectedSeasonId(e.target.value)}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="homeRosterId" className="block text-xs font-bold text-slate-455 uppercase tracking-wider mb-1.5">
            Home Roster
          </label>
          <select
            id="homeRosterId"
            name="homeRosterId"
            required
            className={inputClass}
          >
            <option value="" className="bg-slate-900 text-slate-500">Select Team</option>
            {filteredRosters.map((r) => {
              const team = teamMap.get(r.teamId);
              return (
                <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                  {team?.name} ({r.division})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label htmlFor="awayRosterId" className="block text-xs font-bold text-slate-455 uppercase tracking-wider mb-1.5">
            Away Roster
          </label>
          <select
            id="awayRosterId"
            name="awayRosterId"
            required
            className={inputClass}
          >
            <option value="" className="bg-slate-900 text-slate-500">Select Team</option>
            {filteredRosters.map((r) => {
              const team = teamMap.get(r.teamId);
              return (
                <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                  {team?.name} ({r.division})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="scheduledAt" className="block text-xs font-bold text-slate-455 uppercase tracking-wider mb-1.5">
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
      
      {filteredRosters.length === 0 && selectedSeasonId && (
        <p className="text-[10px] text-amber-500 font-bold mt-2">
          ⚠️ No rosters found for this game. Register rosters first.
        </p>
      )}
    </form>
  );
}
