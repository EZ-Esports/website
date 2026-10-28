'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { HiXMark } from 'react-icons/hi2';
import {
  commitGenerateSeason,
  previewGenerateSeason,
  type GeneratePreview,
} from '@/app/(admin)/admin/matches/generate-season-actions';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { AdminNotice, PendingLabel } from '@/app/components/admin/AdminUI';
import { ghostBtn, helpText, iconBtnSm, input, label as labelClass, primaryBtn, selectClass } from '@/app/components/admin/styles';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import { cx } from '@/app/lib/cx';
import { formatNY } from '@/app/lib/dates';
import { allowedRosterDivisions } from '@/app/lib/school-roster-view';
import { REGULAR_SEASON_MATCHES, isValidYmd, validateParticipantCount } from '@/app/lib/season-schedule';

interface GameOption {
  id: string;
  slug: string;
  displayName: string;
  shortName: string;
}
interface SeasonOption {
  id: string;
  gameId: string;
  name: string;
  isActive: boolean;
}
export interface GenerateSchoolOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  games: GameOption[];
  seasons: SeasonOption[];
  schools: GenerateSchoolOption[];
  /** Called after a successful generate, once the dialog is closed. */
  onGenerated: (message: string) => void;
}

/**
 * Two-step "Generate season" flow: pick the season and schools and preview the result, then
 * confirm in an in-app dialog. Nothing is written until the confirm; the server re-checks
 * everything, so the checks here only give early, readable feedback.
 */
export default function GenerateSeasonDialog({ isOpen, onOpenChange, games, seasons, schools, onGenerated }: Props) {
  const teamGames = useMemo(() => games.filter((g) => allowedRosterDivisions(g.slug)[0] !== 'All'), [games]);
  const [gameId, setGameId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [division, setDivision] = useState<'Varsity' | 'JV'>('Varsity');
  const [startDate, setStartDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [committing, startCommit] = useTransition();

  // Bumped on every edit and every preview; a preview that resolves under an older number was
  // computed for inputs that have since changed and must not be shown or confirmed.
  const previewSeq = useRef(0);

  const resetAll = () => {
    previewSeq.current++;
    setGameId('');
    setSeasonId('');
    setDivision('Varsity');
    setStartDate('');
    setSelected(new Set());
    setPreview(null);
    setError(null);
    setConfirmOpen(false);
    setConfirmError(null);
  };
  const handleOpenChange = (open: boolean) => {
    if (!open) resetAll();
    onOpenChange(open);
  };

  const game = teamGames.find((g) => g.id === gameId);
  const gameSeasons = seasons.filter((s) => s.gameId === gameId);
  const divisions = game ? allowedRosterDivisions(game.slug).filter((d): d is 'Varsity' | 'JV' => d !== 'All') : [];
  const countProblem = selected.size === 0 ? null : validateParticipantCount(selected.size);
  const ready = Boolean(seasonId) && isValidYmd(startDate) && selected.size > 0 && !countProblem;

  const request = () => ({ seasonId, division, schoolIds: [...selected], startDate });
  // Any edit invalidates a shown preview so confirm can never act on stale choices.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    previewSeq.current++;
    set(v);
    setPreview(null);
    setError(null);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    edit(setSelected)(next);
  };

  const runPreview = () =>
    startPreview(async () => {
      setError(null);
      const seq = ++previewSeq.current;
      const res = await previewGenerateSeason(request());
      if (seq !== previewSeq.current) return;
      if (res.success) setPreview(res.preview);
      else {
        setPreview(null);
        setError(res.error);
      }
    });

  const runCommit = () =>
    startCommit(async () => {
      if (!preview) return;
      setConfirmError(null);
      const res = await commitGenerateSeason(request(), preview.fingerprint);
      if (res.success) {
        resetAll();
        onOpenChange(false);
        onGenerated(`Generated ${res.matchesCreated} matches${res.teamsCreated ? ` and ${res.teamsCreated} new teams` : ''}.`);
      } else {
        setConfirmError(res.error);
      }
    });

  return (
    <>
      <Overlay
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        isDismissable={!previewing}
        className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <Modal className="admin-modal max-h-full w-full max-w-2xl outline-none">
          <Dialog className="max-h-[calc(100dvh-2rem)] w-full overflow-auto rounded-2xl bg-surface-raised p-5 shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none sm:p-6">
            {({ close }) => (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Heading className="text-base font-semibold text-foreground">Generate season</Heading>
                    <p className="mt-0.5 text-sm text-foreground-secondary">
                      Every school plays {REGULAR_SEASON_MATCHES} different opponents, one match a week at 7:00 PM ET.
                    </p>
                  </div>
                  <button type="button" onClick={close} aria-label="Close" className={iconBtnSm}>
                    <HiXMark aria-hidden className="h-4 w-4" />
                  </button>
                </div>

                <fieldset disabled={previewing} className="contents">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="gen-game" className={labelClass}>Game</label>
                    <select
                      id="gen-game"
                      value={gameId}
                      onChange={(e) => {
                        edit(setGameId)(e.target.value);
                        setSeasonId('');
                        setDivision('Varsity');
                      }}
                      className={cx(selectClass, 'w-full')}
                    >
                      <option value="">Select a game</option>
                      {teamGames.map((g) => (
                        <option key={g.id} value={g.id}>{g.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="gen-season" className={labelClass}>Season</label>
                    <select
                      id="gen-season"
                      value={seasonId}
                      disabled={!gameId}
                      onChange={(e) => edit(setSeasonId)(e.target.value)}
                      className={cx(selectClass, 'w-full')}
                    >
                      <option value="">{gameId ? 'Select a season' : 'Pick a game first'}</option>
                      {gameSeasons.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' (current)' : ''}</option>
                      ))}
                    </select>
                    <p className={helpText}>Seasons are created in League Setup.</p>
                  </div>
                  <div>
                    <label htmlFor="gen-division" className={labelClass}>Division</label>
                    <select
                      id="gen-division"
                      value={division}
                      onChange={(e) => edit(setDivision)(e.target.value as 'Varsity' | 'JV')}
                      className={cx(selectClass, 'w-full')}
                    >
                      {(divisions.length ? divisions : (['Varsity'] as const)).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="gen-start" className={labelClass}>Week 1 date (Eastern Time)</label>
                    <input
                      id="gen-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => edit(setStartDate)(e.target.value)}
                      className={cx(input, 'w-full')}
                    />
                  </div>
                </div>
                </fieldset>

                <fieldset disabled={previewing}>
                  <legend className={cx(labelClass, 'flex w-full items-center justify-between')}>
                    <span>Participating schools ({selected.size} selected)</span>
                    <span className="flex gap-2 text-xs">
                      <button type="button" className="inline-flex min-h-11 items-center px-1 text-accent hover:underline" onClick={() => edit(setSelected)(new Set(schools.map((s) => s.id)))}>
                        Select all
                      </button>
                      <button type="button" className="inline-flex min-h-11 items-center px-1 text-foreground-secondary hover:underline" onClick={() => edit(setSelected)(new Set())}>
                        Clear
                      </button>
                    </span>
                  </legend>
                  <div className="grid max-h-56 gap-1 overflow-auto rounded-xl bg-admin-panel p-3 sm:grid-cols-2">
                    {schools.map((s) => (
                      <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-accent" />
                        <span className="truncate">{s.name}</span>
                      </label>
                    ))}
                  </div>
                  {countProblem && <p className="admin-fade-in mt-1.5 text-xs font-medium text-danger-on-tint" role="alert">{countProblem}</p>}
                </fieldset>

                {error && <AdminNotice tone="danger">{error}</AdminNotice>}

                <div role="status" aria-live="polite" className="space-y-3">
                  {previewing && <p className="text-sm text-foreground-secondary">Building preview…</p>}
                  {preview && (
                  <div className="space-y-3">
                    <AdminNotice tone="info" title={`${preview.gameName} ${preview.seasonName}, ${preview.division}`}>
                      {preview.matchCount} matches over {preview.weeks.length} weeks.
                    </AdminNotice>
                    <ul className="space-y-1 rounded-xl bg-admin-panel p-3 text-sm text-foreground-secondary">
                      <li>
                        <span className="font-medium text-foreground">Unchanged ({preview.reusedSchools.length}):</span>{' '}
                        {preview.reusedSchools.length ? `${preview.reusedSchools.join(', ')} keep their existing team and ${preview.division} roster.` : 'none'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">New teams ({preview.teamsToCreate.length}):</span>{' '}
                        {preview.teamsToCreate.length ? preview.teamsToCreate.join(', ') : 'none'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">New {preview.division} rosters ({preview.rostersToCreate.length}):</span>{' '}
                        {preview.rostersToCreate.length ? preview.rostersToCreate.join(', ') : 'none'}
                      </li>
                    </ul>
                    <ol className="max-h-64 space-y-3 overflow-auto rounded-xl bg-admin-panel p-3 text-sm">
                      {preview.weeks.map((w) => (
                        <li key={w.round}>
                          <p className="font-medium text-foreground">
                            Week {w.round}: {formatNY(new Date(w.kickoffIso), 'date-short')} {formatNY(new Date(w.kickoffIso), 'time')}
                          </p>
                          <ul className="mt-1 grid gap-x-4 text-foreground-secondary sm:grid-cols-2">
                            {w.matches.map((m, i) => (
                              <li key={i} className="truncate">{m.homeName} vs {m.awayName}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className={ghostBtn}>Cancel</button>
                  <button type="button" disabled={!ready || previewing} onClick={runPreview} className={preview ? ghostBtn : primaryBtn}>
                    <PendingLabel pending={previewing} label={preview ? 'Refresh preview' : 'Preview schedule'} pendingLabel="Building preview…" />
                  </button>
                  {preview && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmError(null);
                        setConfirmOpen(true);
                      }}
                      className={primaryBtn}
                    >
                      Generate season
                    </button>
                  )}
                </div>
              </div>
            )}
          </Dialog>
        </Modal>
      </Overlay>

      <ConfirmActionDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Generate this season?"
        message={
          preview
            ? `This creates ${preview.matchCount} scheduled matches${preview.teamsToCreate.length ? ` and ${preview.teamsToCreate.length} new teams` : ''} for ${preview.seasonName}. It cannot be repeated for a season that already has matches.`
            : ''
        }
        confirmLabel="Generate"
        pendingLabel="Generating…"
        isPending={committing}
        error={confirmError}
        onConfirm={runCommit}
      />
    </>
  );
}
