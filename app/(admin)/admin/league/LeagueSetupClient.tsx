'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FiChevronRight, FiEye, FiEyeOff, FiLock, FiPlus, FiTrash2 } from 'react-icons/fi';
import { HiOutlineCalendarDays, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { useConfirmAction } from '@/app/components/admin/useConfirmAction';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { cancelBtn, chip, chipButton, deleteIconBtn, input, listStack, primaryBtn, saveBtn } from '@/app/components/admin/styles';
import { AdminCount, AdminEmptyState, AdminField, AdminFilterTabs, AdminSection, AdminToast } from '@/app/components/admin/AdminUI';
import {
  createGame, updateGame, deleteGame,
  createSeason, updateSeason, deleteSeason,
} from './actions';
import {
  countSeasonsByStatus,
  filterSeasonsByStatus,
  leagueHref,
  leagueStatusHref,
  seasonDetailHref,
  seasonMovedHint,
  type LeagueView,
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
  /** Set once staff publish the season; null keeps its matches, scores, standings and records off the public site. */
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

/**
 * League Setup: one tab per game, each listing that game's seasons; a season opens its own page
 * (schools, rosters, manager invites, roster lock, publishing). Game management is the last tab.
 */
export default function LeagueSetupClient({
  games,
  seasons,
  view,
  seasonStatus = 'active',
}: {
  games: DBGame[];
  seasons: DBSeason[];
  /** Which tab is selected (from `?game=` / `?view=`, resolved by the page). */
  view: LeagueView;
  /** Which seasons status filter is selected (from `?status=`, validated by the page). */
  seasonStatus?: SeasonStatusFilter;
}) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; action?: { label: string; href: string } } | null>(null);

  const selectedGame = view.kind === 'game' ? games.find((g) => g.slug === view.slug) ?? null : null;
  const gameSeasons = selectedGame ? seasons.filter((s) => s.gameId === selectedGame.id) : [];
  const seasonCounts = countSeasonsByStatus(gameSeasons);
  const visibleSeasons = filterSeasonsByStatus(gameSeasons, seasonStatus);

  const showToast = (message: string, type: 'success' | 'error' = 'success', action?: { label: string; href: string }) => {
    setToast({ message, type, action });
    // Longer when there is a link to read and use.
    if (type === 'success') setTimeout(() => setToast(null), action ? 9000 : 3500);
  };

  /** Success toast for a season save, with a hint when the season left the tab being viewed. */
  const seasonToast = (base: string, fd: FormData): ToastContent => {
    const hint = seasonMovedHint(fd.get('isActive') === 'true', seasonStatus, selectedGame?.slug);
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

  const gamesTabActive = view.kind === 'games' || view.kind === 'empty';

  return (
    <div className="space-y-6">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {/* One tab per game, then game management. Wide sets scroll sideways instead of wrapping. */}
      {games.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <AdminFilterTabs
            label="Games"
            items={[
              ...games.map((g) => ({
                key: g.slug,
                label: g.displayName,
                href: leagueHref({ game: g.slug }),
                active: selectedGame?.id === g.id,
                count: seasons.filter((s) => s.gameId === g.id).length,
              })),
              { key: '__games', label: 'Manage games', href: leagueHref({ view: 'games' }), active: gamesTabActive },
            ]}
          />
        </div>
      )}

      {/* ============ SEASONS OF THE SELECTED GAME ============ */}
      {selectedGame && (
        <AdminSection
          id="seasons"
          variant="flush"
          title={<>{selectedGame.displayName} seasons<AdminCount>{gameSeasons.length}</AdminCount></>}
          toolbar={
            gameSeasons.length > 0 ? (
              <AdminFilterTabs
                label="Filter seasons by status"
                items={(['active', 'inactive', 'all'] as const).map((key) => ({
                  key,
                  label: key === 'active' ? 'Active' : key === 'inactive' ? 'Inactive' : 'All',
                  href: leagueStatusHref(key, selectedGame.slug),
                  active: seasonStatus === key,
                  count: seasonCounts[key],
                }))}
              />
            ) : undefined
          }
          description="Open a season to add its schools, see their rosters, invite managers, lock rosters and publish results. Active seasons show on the public site, and a school manager works on the season whose name matches their affiliation (YYYY-YY), active or not."
        >
          {/* Add season form: the game is the tab you are on. */}
          <form
            onSubmit={(e) => runForm(e, createSeason, (fd) => seasonToast('Season created.', fd), { reset: true })}
            aria-label={`Add ${selectedGame.displayName} season`}
            className={`${addStrip} grid grid-cols-1 items-end gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]`}
          >
            <input type="hidden" name="gameId" value={selectedGame.id} />
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

          {gameSeasons.length === 0 ? (
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
              {visibleSeasons.map((s) => (
                <SeasonRow
                  key={s.id}
                  season={s}
                  gameName={selectedGame.displayName}
                  isPending={isPending}
                  onUpdate={(fd) => runAction(() => updateSeason(s.id, fd), seasonToast('Season updated.', fd))}
                  onDelete={() =>
                    confirmDelete(
                      'Delete season?',
                      `Permanently delete season "${s.name}"? This also deletes its teams, rosters and standings. A season with matches cannot be deleted until those matches are removed. Students are not deleted. This cannot be undone.`,
                      () => deleteSeason(s.id),
                      'Season deleted.',
                    )
                  }
                />
              ))}
            </ul>
          )}
        </AdminSection>
      )}

      {/* ============ GAMES ============ */}
      {gamesTabActive && (
        <AdminSection
          id="games"
          variant="flush"
          title={<>Games<AdminCount>{games.length}</AdminCount></>}
          description="Each game gets its own hub, schedule and standings on the public site, and its own tab here."
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

          {games.length === 0 ? (
            <AdminEmptyState compact icon={<HiOutlinePuzzlePiece />} title="No games yet." description="Add one above to get started. Each game gets a tab for its seasons." />
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
                      `Permanently delete "${g.displayName}"? This also deletes all of its seasons and, with them, every team, roster spot and standing in those seasons. A game with any matches cannot be deleted until those matches are removed. Students and schools are not deleted. This cannot be undone.`,
                      () => deleteGame(g.id),
                      'Game deleted.',
                    )
                  }
                />
              ))}
            </ul>
          )}
        </AdminSection>
      )}

      <ConfirmActionDialog
        {...deletion.dialogProps}
        tone="danger"
        title={deletion.target?.title ?? ''}
        message={deletion.target?.message ?? ''}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
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
  isPending,
  onUpdate,
  onDelete,
}: {
  season: DBSeason;
  gameName: string;
  isPending: boolean;
  onUpdate: (fd: FormData) => Promise<boolean>;
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
            <Link
              href={seasonDetailHref(season.id)}
              className="text-sm font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
              aria-label={`Open ${gameName} season ${season.name}`}
            >
              {season.name}
            </Link>
            <span className={chip(season.isActive ? 'success' : 'neutral')}>
              {season.isActive && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
              {season.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`${chip('neutral')} capitalize`}>{season.standingsFormat ?? 'divided'}</span>
            {/* Status only: lock and publish are set inside the season. */}
            <span className={chip(published ? 'success' : 'neutral')}>
              {published ? <FiEye aria-hidden className="h-3 w-3" /> : <FiEyeOff aria-hidden className="h-3 w-3" />}
              {published ? 'Season published' : 'Season unpublished'}
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
              href={seasonDetailHref(season.id)}
              className={chipButton('ghost')}
              aria-label={`Open season ${season.name}`}
              title="Schools, rosters, invites, roster lock and publishing"
            >
              Open season
              <FiChevronRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
            <RowIconButton kind="edit" onClick={() => setEditing(true)} label={`Edit season ${season.name}`} />
            <button type="button" onClick={onDelete} className={deleteIconBtn} aria-label={`Delete season ${season.name}`} title={`Delete season ${season.name}`}><FiTrash2 aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </li>
  );
}
