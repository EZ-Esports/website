'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
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
  const [homeRosterId, setHomeRosterId] = useState('');
  const [awayRosterId, setAwayRosterId] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  const sameRoster = homeRosterId !== '' && homeRosterId === awayRosterId;

  useEffect(() => {
    if (feedback?.type !== 'success') return;
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setFeedback(null);
    startTransition(async () => {
      const res = await createMatch(fd);
      if (res?.success) {
        setFeedback({ message: 'Match scheduled.', type: 'success' });
        form.reset();
        setHomeRosterId('');
        setAwayRosterId('');
      } else {
        setFeedback({ message: res?.error || 'Could not schedule match.', type: 'error' });
      }
    });
  };

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="seasonId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
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
          <label htmlFor="homeRosterId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Home Roster
          </label>
          <select
            id="homeRosterId"
            name="homeRosterId"
            required
            value={homeRosterId}
            onChange={(e) => setHomeRosterId(e.target.value)}
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
          <label htmlFor="awayRosterId" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Away Roster
          </label>
          <select
            id="awayRosterId"
            name="awayRosterId"
            required
            value={awayRosterId}
            onChange={(e) => setAwayRosterId(e.target.value)}
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
        <label htmlFor="scheduledAt" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
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
        disabled={sameRoster || isPending || seasons.length === 0}
        className="w-full py-2.5 bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? 'Scheduling…' : 'Schedule Match'}
      </button>

      {seasons.length === 0 && (
        <p className="text-[11px] text-amber-400/80 mt-2">
          No seasons exist yet. Create a game and an active season in{' '}
          <Link href="/admin/league" className="underline font-semibold">League Setup</Link>{' '}
          before scheduling matches.
        </p>
      )}

      {sameRoster && (
        <p className="text-[11px] text-amber-400/80 mt-2">
          Home and away rosters must be different.
        </p>
      )}

      {filteredRosters.length === 0 && selectedSeasonId && (
        <p className="text-[11px] text-amber-400/80 mt-2">
          No rosters found for this game. Register rosters first.
        </p>
      )}

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={`text-[11px] mt-2 font-semibold ${
            feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}
