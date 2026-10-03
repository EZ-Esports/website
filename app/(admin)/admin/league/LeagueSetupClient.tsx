'use client';

import { useState, useTransition } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { HiOutlineCalendarDays, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { cancelBtn, chip, deleteIconBtn, input, listStack, primaryBtn, saveBtn } from '@/app/components/admin/styles';
import { AdminCount, AdminEmptyState, AdminField, AdminSection, AdminToast } from '@/app/components/admin/AdminUI';
import {
  createGame, updateGame, deleteGame,
  createSeason, updateSeason, deleteSeason,
} from './actions';

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
}

type ActionResult = { success: boolean; error?: string };

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
}: {
  games: DBGame[];
  seasons: DBSeason[];
}) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    if (type === 'success') setTimeout(() => setToast(null), 3500);
  };

  const runAction = (action: () => Promise<ActionResult>, successMsg: string): Promise<boolean> =>
    new Promise((resolve) => {
      startTransition(async () => {
        const res = await action();
        if (res?.success) {
          showToast(successMsg);
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
    successMsg: string,
    opts?: { reset?: boolean; onSuccess?: () => void },
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.success) {
        showToast(successMsg);
        if (opts?.reset) form.reset();
        opts?.onSuccess?.();
      } else {
        showToast(res?.error || 'Something went wrong.', 'error');
      }
    });
  };

  const confirmDelete = (message: string, action: () => Promise<ActionResult>, successMsg: string) => {
    if (!window.confirm(message)) return;
    runAction(action, successMsg);
  };

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
                    `Delete "${g.displayName}"? This will also delete all linked seasons (cascade). This is permanent.`,
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
        description="Matches and team registrations attach to a season. Active seasons show on the public site."
      >
        {games.length === 0 ? (
          <AdminEmptyState compact icon={<HiOutlineCalendarDays />} title="Create a game first before adding seasons." />
        ) : (
          <>
            {/* Add season form */}
            <form
              onSubmit={(e) => runForm(e, createSeason, 'Season created.', { reset: true })}
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
              <Field label="Season name">
                <input name="name" required placeholder="Spring 2025" className={input} />
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
            ) : (
              <ul className={listStack}>
                {seasons.map((s) => {
                  const game = games.find((g) => g.id === s.gameId);
                  return (
                    <SeasonRow
                      key={s.id}
                      season={s}
                      gameName={game?.displayName ?? 'Unknown Game'}
                      isPending={isPending}
                      onUpdate={(fd) => runAction(() => updateSeason(s.id, fd), 'Season updated.')}
                      onDelete={() =>
                        confirmDelete(
                          `Delete season "${s.name}"? Seasons with existing matches cannot be deleted until those matches are removed or reassigned. This is permanent.`,
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
            <input name="name" required defaultValue={season.name} autoFocus className={input} />
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{season.name}</span>
            <span className="text-sm text-foreground-secondary">{gameName}</span>
            <span className={chip(season.isActive ? 'success' : 'neutral')}>
              {season.isActive && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
              {season.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`${chip('neutral')} capitalize`}>{season.standingsFormat ?? 'divided'}</span>
          </div>
          {/* Row actions stay visible (touch has no hover). */}
          <div className="flex items-center gap-2 shrink-0">
            <RowIconButton kind="edit" onClick={() => setEditing(true)} label={`Edit season ${season.name}`} />
            <button type="button" onClick={onDelete} className={deleteIconBtn} aria-label={`Delete season ${season.name}`} title={`Delete season ${season.name}`}><FiTrash2 aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </li>
  );
}
