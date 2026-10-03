'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { createMatch } from '@/app/(admin)/admin/matches/actions';
import { input, label as labelClass, primaryBtn } from '@/app/components/admin/styles';
import { AdminNotice, PendingLabel } from '@/app/components/admin/AdminUI';

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
  seasonId?: string;
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

  // Filter rosters based on the selected season
  const filteredRosters = useMemo(() => {
    if (!selectedSeasonId) return rosters;
    return rosters.filter(r => {
      const team = teamMap.get(r.teamId);
      return team?.seasonId === selectedSeasonId;
    });
  }, [rosters, selectedSeasonId, teamMap]);

  const inputClass = input;
  const hint = 'admin-fade-in text-xs leading-5 text-warning';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="seasonId" className={labelClass}>
          Active season
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
              <option key={s.id} value={s.id}>
                {game?.displayName || 'Game'} - {s.name}
              </option>
            );
          })}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="homeRosterId" className={labelClass}>
            Home roster
          </label>
          <select
            id="homeRosterId"
            name="homeRosterId"
            required
            value={homeRosterId}
            onChange={(e) => setHomeRosterId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select Team</option>
            {filteredRosters.map((r) => {
              const team = teamMap.get(r.teamId);
              return (
                <option key={r.id} value={r.id}>
                  {team?.name} ({r.division})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label htmlFor="awayRosterId" className={labelClass}>
            Away roster
          </label>
          <select
            id="awayRosterId"
            name="awayRosterId"
            required
            value={awayRosterId}
            onChange={(e) => setAwayRosterId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select Team</option>
            {filteredRosters.map((r) => {
              const team = teamMap.get(r.teamId);
              return (
                <option key={r.id} value={r.id}>
                  {team?.name} ({r.division})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="scheduledAt" className={labelClass}>
          Date &amp; time <span className="font-normal text-foreground-secondary">(Eastern Time)</span>
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
        aria-busy={isPending}
        className={`${primaryBtn} w-full`}
      >
        <PendingLabel pending={isPending} label="Schedule match" pendingLabel="Scheduling…" />
      </button>

      {seasons.length === 0 && (
        <p className={hint}>
          No seasons exist yet. Create a game and an active season in{' '}
          <Link href="/admin/league" className="font-medium underline underline-offset-2">League Setup</Link>{' '}
          before scheduling matches.
        </p>
      )}

      {sameRoster && (
        <p className={hint}>
          Home and away rosters must be different.
        </p>
      )}

      {filteredRosters.length === 0 && selectedSeasonId && (
        <p className={hint}>
          No rosters found for this game. Register rosters first.
        </p>
      )}

      {feedback && (
        <AdminNotice tone={feedback.type === 'success' ? 'success' : 'danger'} live="status">
          {feedback.message}
        </AdminNotice>
      )}
    </form>
  );
}
