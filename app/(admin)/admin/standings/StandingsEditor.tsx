'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import { HiOutlineChartBar } from 'react-icons/hi2';
import {
  listSeasonStandings,
  createStanding,
  updateStanding,
  deleteStanding,
  updateSeasonStandingsFormat,
} from './actions';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import {
  cancelBtn,
  input,
  label as labelClass,
  primaryBtn,
  saveBtn,
  secondaryBtnSm,
  selectClass,
  table,
  tableWrap,
  tbody,
  td,
  tdRight,
  th,
  theadRow,
  thRight,
  tr,
  trEditing,
} from '@/app/components/admin/styles';
import { AdminEmptyState, AdminNotice, AdminSection, AdminSkeletonRows, AdminToast } from '@/app/components/admin/AdminUI';
import { AdminSegmented } from '@/app/components/admin/AdminTabs';
import { cx } from '@/app/lib/cx';
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
      <label className="block">
        <span className={labelClass}>Rank</span>
        <input name="rank" type="number" min="1" defaultValue={row?.rank ?? ''} className={numInput} />
      </label>
      <label className="block">
        <span className={labelClass}>Wins</span>
        <input name="wins" type="number" min="0" defaultValue={row?.wins ?? ''} className={numInput} />
      </label>
      <label className="block">
        <span className={labelClass}>Losses</span>
        <input name="losses" type="number" min="0" defaultValue={row?.losses ?? ''} className={numInput} />
      </label>
      <label className="block">
        <span className={labelClass}>Games</span>
        <input name="gamesPlayed" type="number" min="0" defaultValue={row?.gamesPlayed ?? ''} className={numInput} />
      </label>
      <label className="block">
        <span className={labelClass}>Win %</span>
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
      <label className="block">
        <span className={labelClass}>Points</span>
        <input name="points" type="number" min="0" step="0.5" defaultValue={row?.points ?? ''} className={numInput} />
      </label>
      <label className="block">
        <span className={labelClass}>Player (individual)</span>
        <input name="playerName" defaultValue={row?.playerName ?? ''} placeholder="Leave blank for team rows" className={`${input} w-44`} />
      </label>
      <label className="block">
        <span className={labelClass}>Player IGN</span>
        <input name="playerIgn" defaultValue={row?.playerIgn ?? ''} className={`${input} w-36`} />
      </label>
      <label className="block grow min-w-[180px]">
        <span className={labelClass}>Notes</span>
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

  const { data, fetchError, refresh } = useActionData(
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

  const currentFormat = gameSeasons.find((s) => s.id === seasonId)?.standingsFormat ?? 'divided';

  return (
    <div className="space-y-4">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      <AdminSection
        variant="flush"
        stickyToolbar
        title={`${division} standings`}
        actions={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            disabled={!seasonId || fetchError}
            aria-expanded={adding}
            className={secondaryBtnSm}
          >
            {adding ? <><FiX aria-hidden className="w-3.5 h-3.5" /> Cancel</> : <><FiPlus aria-hidden className="w-3.5 h-3.5" /> Add row</>}
          </button>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Game" value={gameId} onChange={(e) => handleGameChange(e.target.value)} className={selectClass}>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.displayName}</option>
              ))}
            </select>

            <select aria-label="Season" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className={selectClass}>
              {gameSeasons.length === 0 && <option value="">No seasons</option>}
              {gameSeasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' (current)' : ''}</option>
              ))}
            </select>

            {seasonId && (
              <select
                aria-label="Standings format"
                value={currentFormat}
                onChange={async (e) => {
                  const newFormat = e.target.value as 'divided' | 'combined';
                  const res = await updateSeasonStandingsFormat(seasonId, newFormat);
                  if (res?.success) {
                    const s = gameSeasons.find((s) => s.id === seasonId);
                    if (s) s.standingsFormat = newFormat;
                    setToast({ message: `Format set to ${newFormat}.`, type: 'success' });
                    refresh();
                  } else {
                    setToast({ message: res?.error || 'Failed to update format.', type: 'error' });
                  }
                }}
                disabled={isPending}
                className={selectClass}
                title="Standings format (divided or combined)"
              >
                <option value="divided">Divided (Varsity/JV)</option>
                <option value="combined">Combined table</option>
              </select>
            )}

            <AdminSegmented
              aria-label="Division"
              value={division}
              onChange={setDivision}
              options={DIVISIONS.map((d) => ({
                value: d,
                label: (
                  <>
                    {d}
                    {/* The visual gap comes from the flex gap; the sr-only space keeps the
                        accessible name "JV (empty)" rather than "JV(empty)". */}
                    {!usedDivisions.has(d) && (
                      <span className="text-foreground-secondary">
                        <span className="sr-only"> </span>(empty)
                      </span>
                    )}
                  </>
                ),
              }))}
            />
          </div>
        }
      >
        {/* Add-row form */}
        {adding && seasonId && !fetchError && (
          <form
            onSubmit={(e) => runForm(e, createStanding, 'Standing added.', () => setAdding(false))}
            aria-label="Add standing row"
            className="admin-fade-in flex flex-wrap items-end gap-3 border-b border-line/60 bg-surface-raised/30 px-5 py-4"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            <label className="block">
              <span className={labelClass}>School <span aria-hidden className="text-accent">*</span></span>
              <select name="schoolId" required defaultValue="" className={`${input} w-56`}>
                <option value="" disabled>Select school…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <StandingFields division={division} />
            <button type="submit" disabled={isPending} className={primaryBtn}>Add row</button>
          </form>
        )}

        {fetchError && (
          <div className="px-5 pb-4">
            <AdminNotice tone="danger">
              Failed to load standings. Displaying last known data. Please refresh to try again.
            </AdminNotice>
          </div>
        )}

        {/* Standings table */}
        {rows === null ? (
          <AdminSkeletonRows rows={5} />
        ) : divisionRows.length === 0 ? (
          <AdminEmptyState
            compact
            icon={<HiOutlineChartBar />}
            title={`No ${division} snapshot rows for this season.`}
            description="Use “Add row” to record final standings."
          />
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Rank</th>
                  <th className={th}>School / player</th>
                  <th className={th}>W-L</th>
                  <th className={th}>Games</th>
                  <th className={th}>Win %</th>
                  <th className={th}>Points</th>
                  <th className={th}>Notes</th>
                  <th className={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {divisionRows.map((row) => {
                  if (editingId === row.id && !fetchError) {
                    return (
                      <tr key={row.id} className={trEditing}>
                        <td colSpan={8} className="px-5 py-4">
                          <form
                            onSubmit={(e) => runForm(e, (fd) => updateStanding(row.id, fd), 'Standing updated.', () => setEditingId(null))}
                            className="admin-fade-in flex flex-wrap items-end gap-3"
                          >
                            <div className="w-full pb-1 text-sm font-medium text-foreground">{row.schoolName}</div>
                            <StandingFields row={row} division={division} />
                            <div className="flex gap-2 pb-0.5">
                              <button type="submit" disabled={isPending} className={saveBtn}>Save</button>
                              <button type="button" onClick={() => setEditingId(null)} className={cancelBtn}>Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.id} className={tr}>
                      <td className={cx(td, 'font-semibold tabular-nums text-foreground-secondary')}>{row.rank ?? '—'}</td>
                      <td className={td}>
                        <div className="font-medium text-foreground">{row.playerName ?? row.schoolName}</div>
                        {row.playerName && (
                          <div className="text-xs text-foreground-secondary">
                            {row.schoolName}
                            {row.playerIgn ? ` · ${row.playerIgn}` : ''}
                          </div>
                        )}
                      </td>
                      <td className={cx(td, 'tabular-nums text-foreground-secondary')}>
                        {row.wins !== null || row.losses !== null ? `${row.wins ?? 0}-${row.losses ?? 0}` : '—'}
                      </td>
                      <td className={cx(td, 'tabular-nums text-foreground-secondary')}>{row.gamesPlayed ?? '—'}</td>
                      <td className={cx(td, 'font-medium tabular-nums text-foreground')}>
                        {row.winPct !== null ? `${(row.winPct * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className={cx(td, 'tabular-nums text-foreground-secondary')}>{row.points ?? '—'}</td>
                      <td className={cx(td, 'max-w-[220px] truncate text-xs text-foreground-secondary')} title={row.notes ?? ''}>
                        {row.notes ?? ''}
                      </td>
                      <td className={tdRight}>
                        <div className="flex items-center justify-end gap-2">
                          <RowIconButton kind="edit" disabled={fetchError} onClick={() => setEditingId(row.id)} label={`Edit ${row.playerName ?? row.schoolName} standing`} />
                          <ConfirmDeleteButton
                            action={async () => {
                              const res = await deleteStanding(row.id);
                              if (res?.success) refresh();
                              else setToast({ message: res?.error || 'Could not delete row.', type: 'error' });
                            }}
                            message={`Delete the ${row.playerName ?? row.schoolName} row from these standings? This cannot be undone.`}
                            label={`Delete ${row.playerName ?? row.schoolName} standing`}
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
      </AdminSection>

      <p className="max-w-3xl text-xs leading-5 text-foreground-secondary">
        These snapshots power the public standings pages for seasons whose match scores were never recorded.
        Seasons without snapshot rows fall back to standings computed live from match results.
        For individual competitions (e.g. Teamfight Tactics), set the player name and keep W-L blank.
      </p>
    </div>
  );
}
