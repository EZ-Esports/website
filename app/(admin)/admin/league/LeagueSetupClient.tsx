'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FiEye, FiEyeOff, FiList, FiLock, FiPlus, FiTrash2, FiUnlock } from 'react-icons/fi';
import { HiOutlineCalendarDays, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { useConfirmAction } from '@/app/components/admin/useConfirmAction';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { cancelBtn, chip, chipButton, deleteIconBtn, input, listStack, primaryBtn, saveBtn } from '@/app/components/admin/styles';
import { AdminCount, AdminEmptyState, AdminField, AdminFilterTabs, AdminSection, AdminToast } from '@/app/components/admin/AdminUI';
import {
  createGame, updateGame, deleteGame,
  createSeason, updateSeason, deleteSeason,
  lockSeasonRosters, unlockSeasonRosters,
  publishSeasonOutcomes, hideSeasonOutcomes,
} from './actions';
import {
  countSeasonsByStatus,
  filterSeasonsByStatus,
  leagueStatusHref,
  seasonMovedHint,
  seasonMatchesHref,
  type SeasonStatusFilter,
} from '@/app/lib/admin-season-filters';

interface DBGame {
  id: string;
  displayName: string;
  shortName: string;
  slug: string;
  imageUrl: string | null;
}

interface DBSeason {
  id: string;
  gameId: string;
  name: string;
  isActive: boolean;
  standingsFormat?: string;
  /** Set while staff have locked this season's rosters against manager changes. */
  rostersLockedAt?: Date | string | null;
  /** Set once staff publish this season's results; null keeps scores, standings and records off the public site. */
  outcomesFinalizedAt?: Date | string | null;
}

type ActionResult = { success: boolean; error?: string };
type ToastContent = { message: string; action?: { label: string; href: string } };

/** Label-wrapped field with the admin label style (spec-013). */
function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: React.ReactNode }) {
  return (
    <AdminField label={label} help={help}>
      {children}
    </AdminField>
  );
}

/** Add-form strip at the top of a list panel: one hairline below it, no box of its own. */
const addStrip = 'border-b border-line/60 px-5 pb-5';

export default function LeagueSetupClient({
  games,
  seasons,
  seasonStatus = 'active',
}: {
  games: DBGame[];
  seasons: DBSeason[];
  /** Which seasons tab is selected (from `?status=`, validated by the page). */
  seasonStatus?: SeasonStatusFilter;
}) {
  const seasonCounts = countSeasonsByStatus(seasons);
  const visibleSeasons = filterSeasonsByStatus(seasons, seasonStatus);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; action?: { label: string; href: string } } | null>(null);
  const [lockTarget, setLockTarget] = useState<{ seasonId: string; locking: boolean; title: string; message: string } | null>(null);
  const [outcomesTarget, setOutcomesTarget] = useState<{ seasonId: string; publishing: boolean; title: string; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success', action?: { label: string; href: string }) => {
    setToast({ message, type, action });
    // Longer when there is a link to read and use.
    if (type === 'success') setTimeout(() => setToast(null), action ? 9000 : 3500);
  };

  /** Success toast for a season save, with a hint when the season left the tab being viewed. */
  const seasonToast = (base: string, fd: FormData): ToastContent => {
    const hint = seasonMovedHint(fd.get('isActive') === 'true', seasonStatus);
    return hint
      ? { message: `${base} ${hint.text}`, action: { label: hint.actionLabel, href: hint.href } }
      : { message: base };
  };

  const runAction = (action: () => Promise<ActionResult>, successMsg: ToastContent | string): Promise<boolean> =>
    new Promise((resolve) => {
      startTransition(async () => {
        const res = await action();
        if (res?.success) {
          const c = typeof successMsg === 'string' ? { message: successMsg } : successMsg;
          showToast(c.message, 'success', c.action);
          resolve(true);
        } else {
          showToast(res?.error || 'Something went wrong.', 'error');
          resolve(false);
        }
      });
    });

  const runForm = (
    e: React.FormEvent<HTMLFormElement>,
    action: (fd: FormData) => Promise<ActionResult>,
    successMsg: ToastContent | string | ((fd: FormData) => ToastContent),
    opts?: { reset?: boolean; onSuccess?: () => void },
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.success) {
        const c = typeof successMsg === 'function' ? successMsg(fd) : typeof successMsg === 'string' ? { message: successMsg } : successMsg;
        showToast(c.message, 'success', c.action);
        if (opts?.reset) form.reset();
        opts?.onSuccess?.();
      } else {
        showToast(res?.error || 'Something went wrong.', 'error');
      }
    });
  };

  // A delete only runs from the confirm dialog. A failure stays in the dialog (the
  // toast sits behind its backdrop) so it can be read, retried or cancelled.
  const deletion = useConfirmAction<{ title: string; message: string; action: () => Promise<ActionResult>; successMsg: string }>(
    async ({ action, successMsg }) => {
      const res = await action();
      if (res?.success) showToast(successMsg, 'success');
      return res ?? { success: false, error: 'Something went wrong.' };
    },
  );
  const confirmDelete = (title: string, message: string, action: () => Promise<ActionResult>, successMsg: string) =>
    deletion.request({ title, message, action, successMsg });

  return (
    <div className="space-y-6">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {/* ============ GAMES ============ */}
      <AdminSection
        id="games"
        variant="flush"
        title={<>Games<AdminCount>{games.length}</AdminCount></>}
        description="Each game gets its own hub, schedule and standings on the public site."
      >
        {/* Add game form */}
        <form
          onSubmit={(e) => runForm(e, createGame, 'Game created.', { reset: true })}
          aria-label="Add game"
          className={`${addStrip} grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]`}
        >
          <Field label="Display name">
            <input name="displayName" required placeholder="League of Legends" className={input} />
          </Field>
          <Field label="Short name">
            <input name="shortName" required placeholder="LoL" className={input} />
          </Field>
          <Field label="Image URL (optional)">
            <input name="imageUrl" placeholder="https://…" className={input} />
          </Field>
          <button type="submit" disabled={isPending} className={primaryBtn}>
            <FiPlus aria-hidden /> Add game
          </button>
        </form>

        {/* Games list */}
        {games.length === 0 ? (
          <AdminEmptyState compact icon={<HiOutlinePuzzlePiece />} title="No games yet." description="Add one above to get started." />
        ) : (
          <ul className={listStack}>
            {games.map((g) => (
              <GameRow
                key={g.id}
                game={g}
                isPending={isPending}
                onUpdate={(fd) => runAction(() => updateGame(g.id, fd), 'Game updated.')}
                onDelete={() =>
                  confirmDelete(
                    'Delete game?',
                    `Permanently delete "${g.displayName}"? This also deletes all of its seasons and, with them, every team, roster spot, match, result and standing in those seasons. Students and schools are not deleted. This cannot be undone.`,
                    () => deleteGame(g.id),
                    'Game deleted.',
                  )
                }
              />
            ))}
          </ul>
        )}
      </AdminSection>

      {/* ============ SEASONS ============ */}
      <AdminSection
        id="seasons"
        variant="flush"
        title={<>Seasons<AdminCount>{seasons.length}</AdminCount></>}
        toolbar={
          games.length > 0 && seasons.length > 0 ? (
            <AdminFilterTabs
              label="Filter seasons by status"
              items={(['active', 'inactive', 'all'] as const).map((key) => ({
                key,
                label: key === 'active' ? 'Active' : key === 'inactive' ? 'Inactive' : 'All',
                href: leagueStatusHref(key),
                active: seasonStatus === key,
                count: seasonCounts[key],
              }))}
            />
          ) : undefined
        }
        description="Matches and team registrations attach to a season. Active seasons show on the public site, and a school manager works on the season whose name matches their affiliation (YYYY-YY), active or not. Scores, results, standings and records stay hidden from the public until you publish a season's results."
      >
        {games.length === 0 ? (
          <AdminEmptyState compact icon={<HiOutlineCalendarDays />} title="Create a game first before adding seasons." />
        ) : (
          <>
            {/* Add season form */}
            <form
              onSubmit={(e) => runForm(e, createSeason, (fd) => seasonToast('Season created.', fd), { reset: true })}
              aria-label="Add season"
              className={`${addStrip} grid grid-cols-1 items-end gap-3 md:grid-cols-[1.5fr_1.5fr_1fr_1fr_auto]`}
            >
              <Field label="Game">
                <select name="gameId" required defaultValue="" className={input}>
                  <option value="" disabled>Select game…</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>{g.displayName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Season name" help="Format YYYY-YY, e.g. 2025-26.">
                <input
                  name="name"
                  required
                  placeholder="2025-26"
                  maxLength={7}
                  pattern="\d{4}-\d{2}"
                  title="Format YYYY-YY, for example 2025-26"
                  className={input}
                />
              </Field>
              <Field label="Active?">
                <select name="isActive" defaultValue="true" className={input}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
              <Field label="Standings format">
                <select name="standingsFormat" defaultValue="divided" className={input}>
                  <option value="divided">Divided</option>
                  <option value="combined">Combined</option>
                </select>
              </Field>
              <button type="submit" disabled={isPending} className={primaryBtn}>
                <FiPlus aria-hidden /> Add season
              </button>
            </form>

            {/* Seasons list */}
            {seasons.length === 0 ? (
              <AdminEmptyState compact icon={<HiOutlineCalendarDays />} title="No seasons yet." description="Add one above." />
            ) : visibleSeasons.length === 0 ? (
              <AdminEmptyState
                compact
                icon={<HiOutlineCalendarDays />}
                title={`No ${seasonStatus} seasons.`}
                description={seasonStatus === 'active' ? 'Every season is inactive. Switch to Inactive or All to see them.' : 'Every season is active. Switch to Active or All to see them.'}
              />
            ) : (
              <ul className={listStack}>
                {visibleSeasons.map((s) => {
                  const game = games.find((g) => g.id === s.gameId);
                  return (
                    <SeasonRow
                      key={s.id}
                      season={s}
                      gameName={game?.displayName ?? 'Unknown Game'}
                      matchesHref={seasonMatchesHref(s.id, game?.slug)}
                      isPending={isPending}
                      onUpdate={(fd) => runAction(() => updateSeason(s.id, fd), seasonToast('Season updated.', fd))}
                      onToggleLock={() => {
                        const locking = !s.rostersLockedAt;
                        const message = locking
                          ? `School managers will not be able to create, delete or change rosters (including emergency swaps) or approve players onto them until you unlock. Staff admins can still edit.${s.isActive ? '' : ' This season is inactive; managers whose affiliation names it are still locked out.'}`
                          : 'School managers will be able to change rosters again.';
                        setLockTarget({
                          seasonId: s.id,
                          locking,
                          title: `${locking ? 'Lock' : 'Unlock'} rosters for ${game?.displayName ?? 'this game'} ${s.name}?`,
                          message,
                        });
                      }}
                      onToggleOutcomes={() => {
                        const publishing = !s.outcomesFinalizedAt;
                        setOutcomesTarget({
                          seasonId: s.id,
                          publishing,
                          title: `${publishing ? 'Publish' : 'Hide'} results for ${game?.displayName ?? 'this game'} ${s.name}?`,
                          message: publishing
                            ? 'Scores, match results, standings, team records and champions for this season will become visible on the public site, the homepage and the archive. Only publish once the results for the season are complete.'
                            : 'Scores, match results, standings, team records and champions for this season will be removed from the public site. Schedules and team lists stay. Staff views are not affected.',
                        });
                      }}
                      onDelete={() =>
                        confirmDelete(
                          'Delete season?',
                          `Permanently delete season "${s.name}"? This also deletes its teams, rosters and standings. A season with matches cannot be deleted until those matches are removed. Students are not deleted. This cannot be undone.`,
                          () => deleteSeason(s.id),
                          'Season deleted.',
                        )
                      }
                    />
                  );
                })}
              </ul>
            )}
          </>
        )}
      </AdminSection>

      <ConfirmActionDialog
        {...deletion.dialogProps}
        tone="danger"
        title={deletion.target?.title ?? ''}
        message={deletion.target?.message ?? ''}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
      />

      <ConfirmActionDialog
        isOpen={outcomesTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOutcomesTarget(null);
        }}
        title={outcomesTarget?.title ?? ''}
        message={outcomesTarget?.message ?? ''}
        confirmLabel={outcomesTarget?.publishing ? 'Publish results' : 'Hide results'}
        pendingLabel={outcomesTarget?.publishing ? 'Publishing…' : 'Hiding…'}
        isPending={isPending}
        icon={outcomesTarget?.publishing ? <FiEye className="h-5 w-5" /> : <FiEyeOff className="h-5 w-5" />}
        onConfirm={async () => {
          if (!outcomesTarget) return;
          const { seasonId, publishing } = outcomesTarget;
          await runAction(
            () => (publishing ? publishSeasonOutcomes(seasonId) : hideSeasonOutcomes(seasonId)),
            publishing ? 'Results published.' : 'Results hidden.',
          );
          setOutcomesTarget(null);
        }}
      />

      <ConfirmActionDialog
        isOpen={lockTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLockTarget(null);
        }}
        title={lockTarget?.title ?? ''}
        message={lockTarget?.message ?? ''}
        confirmLabel={lockTarget?.locking ? 'Lock rosters' : 'Unlock rosters'}
        pendingLabel={lockTarget?.locking ? 'Locking…' : 'Unlocking…'}
        isPending={isPending}
        icon={lockTarget?.locking ? <FiLock className="h-5 w-5" /> : <FiUnlock className="h-5 w-5" />}
        onConfirm={async () => {
          if (!lockTarget) return;
          const { seasonId, locking } = lockTarget;
          await runAction(
            () => (locking ? lockSeasonRosters(seasonId) : unlockSeasonRosters(seasonId)),
            locking ? 'Rosters locked.' : 'Rosters unlocked.',
          );
          setLockTarget(null);
        }}
      />
    </div>
  );
}

function GameRow({
  game,
  isPending,
  onUpdate,
  onDelete,
}: {
  game: DBGame;
  isPending: boolean;
  onUpdate: (fd: FormData) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className={`group px-5 py-3.5 transition-colors duration-150 ${editing ? 'bg-surface-raised/40' : 'hover:bg-surface-raised/50'}`}>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onUpdate(new FormData(e.currentTarget));
            if (ok) setEditing(false);
          }}
          className="admin-fade-in grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end"
        >
          <Field label="Display name">
            <input name="displayName" required defaultValue={game.displayName} autoFocus className={input} />
          </Field>
          <Field label="Short name">
            <input name="shortName" required defaultValue={game.shortName} className={input} />
          </Field>
          <Field label="Image URL">
            <input name="imageUrl" defaultValue={game.imageUrl ?? ''} className={input} />
          </Field>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" disabled={isPending} className={saveBtn}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className={cancelBtn}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{game.displayName}</span>
              <span className={chip('neutral')}>{game.shortName}</span>
            </div>
            <div className="mt-0.5 font-mono text-xs text-foreground-secondary">/games/{game.slug}</div>
          </div>
          {/* Row actions stay visible (touch has no hover). */}
          <div className="flex items-center gap-2 shrink-0">
            <RowIconButton kind="edit" onClick={() => setEditing(true)} label={`Edit game ${game.displayName}`} />
            <button type="button" onClick={onDelete} className={deleteIconBtn} aria-label={`Delete game ${game.displayName}`} title={`Delete game ${game.displayName}`}><FiTrash2 aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </li>
  );
}

function SeasonRow({
  season,
  gameName,
  matchesHref,
  isPending,
  onUpdate,
  onToggleLock,
  onToggleOutcomes,
  onDelete,
}: {
  season: DBSeason;
  gameName: string;
  /** Matches pre-filtered to this season and game. */
  matchesHref: string;
  isPending: boolean;
  onUpdate: (fd: FormData) => Promise<boolean>;
  onToggleLock: () => void;
  onToggleOutcomes: () => void;
  onDelete: () => void;
}) {
  const locked = !!season.rostersLockedAt;
  const published = !!season.outcomesFinalizedAt;
  const [editing, setEditing] = useState(false);

  return (
    <li className={`group px-5 py-3.5 transition-colors duration-150 ${editing ? 'bg-surface-raised/40' : 'hover:bg-surface-raised/50'}`}>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onUpdate(new FormData(e.currentTarget));
            if (ok) setEditing(false);
          }}
          className="admin-fade-in grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_1fr_1fr_auto] gap-3 items-end"
        >
          <Field label="Game" help="Game can't be changed after creation.">
            <div className={`${input} flex items-center text-foreground-secondary`} aria-readonly="true">
              {gameName}
            </div>
            {/* Game is fixed for a season; submit it unchanged so the server action still receives it */}
            <input type="hidden" name="gameId" value={season.gameId} />
          </Field>
          <Field label="Season name">
            <input
              name="name"
              required
              defaultValue={season.name}
              autoFocus
              placeholder="2025-26"
              title="Format YYYY-YY, for example 2025-26"
              className={input}
            />
          </Field>
          <Field label="Active?">
            <select name="isActive" defaultValue={season.isActive ? 'true' : 'false'} className={input}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </Field>
          <Field label="Format">
            <select name="standingsFormat" defaultValue={season.standingsFormat ?? 'divided'} className={input}>
              <option value="divided">Divided</option>
              <option value="combined">Combined</option>
            </select>
          </Field>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" disabled={isPending} className={saveBtn}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className={cancelBtn}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{season.name}</span>
            <span className="text-sm text-foreground-secondary">{gameName}</span>
            <span className={chip(season.isActive ? 'success' : 'neutral')}>
              {season.isActive && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
              {season.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`${chip('neutral')} capitalize`}>{season.standingsFormat ?? 'divided'}</span>
            <span className={chip(published ? 'success' : 'neutral')}>
              {published ? <FiEye aria-hidden className="h-3 w-3" /> : <FiEyeOff aria-hidden className="h-3 w-3" />}
              {published ? 'Results public' : 'Results hidden'}
            </span>
            {locked && (
              <span className={chip('warning')}>
                <FiLock aria-hidden className="h-3 w-3" />
                Rosters locked
              </span>
            )}
          </div>
          {/* Row actions stay visible (touch has no hover). */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={matchesHref}
              className={chipButton('ghost')}
              aria-label={`View matches for ${gameName} season ${season.name}`}
              title="Open Matches filtered to this season"
            >
              <FiList aria-hidden className="h-3.5 w-3.5" />
              View matches
            </Link>
            <button
              type="button"
              onClick={onToggleLock}
              disabled={isPending}
              className={chipButton(locked ? 'warning' : 'ghost')}
              aria-label={locked ? `Unlock rosters for season ${season.name}` : `Lock rosters for season ${season.name}`}
              title={locked ? 'Let school managers change rosters again' : 'Stop school managers from changing rosters'}
            >
              {locked ? <FiUnlock aria-hidden className="h-3.5 w-3.5" /> : <FiLock aria-hidden className="h-3.5 w-3.5" />}
              {locked ? 'Unlock rosters' : 'Lock rosters'}
            </button>
            <button
              type="button"
              onClick={onToggleOutcomes}
              disabled={isPending}
              className={chipButton(published ? 'ghost' : 'warning')}
              aria-label={published ? `Hide results for season ${season.name}` : `Publish results for season ${season.name}`}
              title={published ? 'Remove scores, standings and records from the public site' : 'Show scores, standings and records on the public site'}
            >
              {published ? <FiEyeOff aria-hidden className="h-3.5 w-3.5" /> : <FiEye aria-hidden className="h-3.5 w-3.5" />}
              {published ? 'Hide results' : 'Publish results'}
            </button>
            <RowIconButton kind="edit" onClick={() => setEditing(true)} label={`Edit season ${season.name}`} />
            <button type="button" onClick={onDelete} className={deleteIconBtn} aria-label={`Delete season ${season.name}`} title={`Delete season ${season.name}`}><FiTrash2 aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </li>
  );
}
