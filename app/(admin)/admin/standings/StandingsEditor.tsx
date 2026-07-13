'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import {
  listSeasonStandings,
  createStanding,
  updateStanding,
  deleteStanding,
} from './actions';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import { input, primaryBtn, secondaryBtn, iconBtn, selectClass } from '@/app/components/admin/styles';
import { useActionData } from '@/app/lib/hooks/useActionData';
import { DIVISIONS } from '@/app/lib/db/match-page';
import type { DBGame, DBSchool, DBSeason } from '@/app/types';

type StandingRow = Awaited<ReturnType<typeof listSeasonStandings>>[number];
type ActionResult = { success: boolean; error?: string };

const numInput = `${input} w-20`;

interface StandingsEditorProps {
  games: DBGame[];
  seasons: DBSeason[];
  schools: DBSchool[];
}

/** Fields shared by the add-row and edit-row forms. */
function StandingFields({ row, division }: { row?: StandingRow; division: string }) {
  return (
    <>
      <input type="hidden" name="division" value={division} />
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Rank</span>
        <input name="rank" type="number" min="1" defaultValue={row?.rank ?? ''} className={numInput} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Wins</span>
        <input name="wins" type="number" min="0" defaultValue={row?.wins ?? ''} className={numInput} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Losses</span>
        <input name="losses" type="number" min="0" defaultValue={row?.losses ?? ''} className={numInput} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Games</span>
        <input name="gamesPlayed" type="number" min="0" defaultValue={row?.gamesPlayed ?? ''} className={numInput} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Win %</span>
        <input
          name="winPct"
          type="number"
          min="0"
          max="100"
          step="0.1"
          defaultValue={row?.winPct !== null && row?.winPct !== undefined ? (row.winPct * 100).toFixed(1) : ''}
          placeholder="0-100"
          className={numInput}
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Points</span>
        <input name="points" type="number" min="0" step="0.5" defaultValue={row?.points ?? ''} className={numInput} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Player (individual)</span>
        <input name="playerName" defaultValue={row?.playerName ?? ''} placeholder="Leave blank for team rows" className={`${input} w-44`} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Player IGN</span>
        <input name="playerIgn" defaultValue={row?.playerIgn ?? ''} className={`${input} w-36`} />
      </label>
      <label className="block space-y-1 grow min-w-[180px]">
        <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Notes</span>
        <input name="notes" defaultValue={row?.notes ?? ''} placeholder="e.g. Total Points: 120" className={input} />
      </label>
    </>
  );
}

export default function StandingsEditor({ games, seasons, schools }: StandingsEditorProps) {
  const [gameId, setGameId] = useState(games[0]?.id ?? '');
  const gameSeasons = useMemo(() => seasons.filter((s) => s.gameId === gameId), [seasons, gameId]);
  const [seasonId, setSeasonId] = useState(() => seasons.find((s) => s.gameId === gameId)?.id ?? '');
  const [division, setDivision] = useState('Varsity');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleGameChange = (id: string) => {
    setGameId(id);
    setSeasonId(seasons.find((s) => s.gameId === id)?.id ?? '');
  };

  const { data, refresh } = useActionData(
    () => (seasonId ? listSeasonStandings(seasonId) : Promise.resolve([] as StandingRow[])),
    seasonId,
    [] as StandingRow[],
  );
  const rows = data;

  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const divisionRows = (rows ?? []).filter((r) => r.division === division);
  const usedDivisions = new Set((rows ?? []).map((r) => r.division));

  const runForm = (
    e: React.FormEvent<HTMLFormElement>,
    action: (fd: FormData) => Promise<ActionResult>,
    successMsg: string,
    onSuccess?: () => void
  ) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.success) {
        setToast({ message: successMsg, type: 'success' });
        onSuccess?.();
        refresh();
      } else {
        setToast({ message: res?.error || 'Something went wrong.', type: 'error' });
      }
    });
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            toast.type === 'error'
              ? 'bg-red-950/30 border-red-900/50 text-red-300'
              : 'bg-success/30 border-success/50 text-success'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-foreground-secondary hover:text-foreground" aria-label="Dismiss">
            <FiX />
          </button>
        </div>
      )}

      {/* Scope selectors */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={gameId} onChange={(e) => handleGameChange(e.target.value)} className={selectClass}>
          {games.map((g) => (
            <option key={g.id} value={g.id}>{g.displayName}</option>
          ))}
        </select>

        <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className={selectClass}>
          {gameSeasons.length === 0 && <option value="">No seasons</option>}
          {gameSeasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' (current)' : ''}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {DIVISIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDivision(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                division === d
                  ? 'bg-accent text-on-accent'
                  : 'bg-surface-raised border border-line/80 text-foreground-secondary hover:text-white'
              }`}
            >
              {d}{usedDivisions.has(d) ? '' : ' (empty)'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!seasonId}
          className={`${selectClass} font-bold flex items-center gap-1.5 disabled:opacity-40`}
        >
          {adding ? <><FiX className="w-3.5 h-3.5" /> Cancel</> : <><FiPlus className="w-3.5 h-3.5" /> Add row</>}
        </button>
      </div>

      {/* Add-row form */}
      {adding && seasonId && (
        <form
          onSubmit={(e) => runForm(e, createStanding, 'Standing added.', () => setAdding(false))}
          className="bg-surface-sunken/60 border border-line rounded-xl p-4 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="seasonId" value={seasonId} />
          <label className="block space-y-1">
            <span className="block text-[10px] font-bold text-foreground-muted uppercase tracking-wider">School *</span>
            <select name="schoolId" required defaultValue="" className={`${input} w-56`}>
              <option value="" disabled>Select school…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <StandingFields division={division} />
          <button type="submit" disabled={isPending} className={primaryBtn}>Add</button>
        </form>
      )}

      {/* Standings table */}
      <div className="bg-[#1c1c1c]/60 border border-line rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        {rows === null ? (
          <div className="text-center p-12 text-foreground-muted text-sm">Loading standings…</div>
        ) : divisionRows.length === 0 ? (
          <div className="text-center p-12 text-foreground-muted text-sm">
            No {division} snapshot rows for this season. Use “Add row” to record final standings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#0b101d] border-b border-surface-raised text-xs font-bold text-foreground-secondary uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">School / Player</th>
                  <th className="px-4 py-3">W-L</th>
                  <th className="px-4 py-3">Games</th>
                  <th className="px-4 py-3">Win %</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {divisionRows.map((row) => {
                  if (editingId === row.id) {
                    return (
                      <tr key={row.id} className="bg-surface-raised/40">
                        <td colSpan={8} className="px-4 py-3">
                          <form
                            onSubmit={(e) => runForm(e, (fd) => updateStanding(row.id, fd), 'Standing updated.', () => setEditingId(null))}
                            className="flex flex-wrap items-end gap-3"
                          >
                            <div className="text-xs font-bold text-foreground-secondary pb-2 w-full">{row.schoolName}</div>
                            <StandingFields row={row} division={division} />
                            <div className="flex gap-2 pb-0.5">
                              <button type="submit" disabled={isPending} className={primaryBtn}>Save</button>
                              <button type="button" onClick={() => setEditingId(null)} className={secondaryBtn}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.id} className="hover:bg-line/10 transition-colors group">
                      <td className="px-4 py-3 font-bold text-foreground-secondary">{row.rank ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{row.playerName ?? row.schoolName}</div>
                        {row.playerName && (
                          <div className="text-[11px] text-foreground-muted">
                            {row.schoolName}
                            {row.playerIgn ? ` · ${row.playerIgn}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground-secondary font-medium">
                        {row.wins !== null || row.losses !== null ? `${row.wins ?? 0}-${row.losses ?? 0}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.gamesPlayed ?? '—'}</td>
                      <td className="px-4 py-3 text-foreground-secondary font-bold">
                        {row.winPct !== null ? `${(row.winPct * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.points ?? '—'}</td>
                      <td className="px-4 py-3 text-foreground-muted text-xs max-w-[220px] truncate" title={row.notes ?? ''}>
                        {row.notes ?? ''}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <button onClick={() => setEditingId(row.id)} className={iconBtn} aria-label="Edit standing">
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <ConfirmDeleteButton
                            action={async () => {
                              const res = await deleteStanding(row.id);
                              if (res?.success) refresh();
                              else setToast({ message: res?.error || 'Could not delete row.', type: 'error' });
                            }}
                            message={`Delete the ${row.playerName ?? row.schoolName} row from these standings? This cannot be undone.`}
                            label="Delete"
                            className="px-3 py-1.5 bg-surface-raised hover:bg-red-950/20 font-bold text-[10px] uppercase tracking-wider rounded text-foreground-secondary hover:text-red-400 border border-line transition-all cursor-pointer"
                          />
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

      <p className="text-[11px] text-foreground-muted leading-relaxed">
        These snapshots power the public standings pages for seasons whose match scores were never recorded.
        Seasons without snapshot rows fall back to standings computed live from match results.
        For individual competitions (e.g. TFT), set the player name and keep W-L blank.
      </p>
    </div>
  );
}
