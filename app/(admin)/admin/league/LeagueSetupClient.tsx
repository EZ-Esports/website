'use client';

import { useState, useTransition } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
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
}

type ActionResult = { success: boolean; error?: string };

const input =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ez-pink/50 focus:border-ez-pink/30 transition-all';
const primaryBtn =
  'px-4 py-2 bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
const secondaryBtn =
  'px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer';
const iconBtn =
  'p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

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
    <div className="space-y-8">
      {toast && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            toast.type === 'error'
              ? 'bg-red-950/30 border-red-900/50 text-red-300'
              : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-200" aria-label="Dismiss">
            <FiX />
          </button>
        </div>
      )}

      {/* ============ GAMES ============ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-black text-white uppercase tracking-wider">Games</h2>
        </div>

        {/* Add game form */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add Game</span>
          <form
            onSubmit={(e) => runForm(e, createGame, 'Game created.', { reset: true })}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end"
          >
            <Field label="Display Name">
              <input name="displayName" required placeholder="League of Legends" className={input} />
            </Field>
            <Field label="Short Name">
              <input name="shortName" required placeholder="LoL" className={input} />
            </Field>
            <Field label="Image URL (optional)">
              <input name="imageUrl" placeholder="https://…" className={input} />
            </Field>
            <button type="submit" disabled={isPending} className={primaryBtn}>
              <FiPlus /> Add
            </button>
          </form>
        </div>

        {/* Games list */}
        {games.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl">
            No games yet. Add one above to get started.
          </div>
        ) : (
          <div className="border border-slate-900 rounded-xl divide-y divide-slate-900">
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
          </div>
        )}
      </section>

      {/* ============ SEASONS ============ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-black text-white uppercase tracking-wider">Seasons</h2>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl">
            Create a game first before adding seasons.
          </div>
        ) : (
          <>
            {/* Add season form */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add Season</span>
              <form
                onSubmit={(e) => runForm(e, createSeason, 'Season created.', { reset: true })}
                className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_1fr_auto] gap-3 items-end"
              >
                <Field label="Game">
                  <select name="gameId" required defaultValue="" className={input}>
                    <option value="" disabled>Select game…</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>{g.displayName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Season Name">
                  <input name="name" required placeholder="Spring 2025" className={input} />
                </Field>
                <Field label="Active?">
                  <select name="isActive" defaultValue="true" className={input}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
                <button type="submit" disabled={isPending} className={primaryBtn}>
                  <FiPlus /> Add
                </button>
              </form>
            </div>

            {/* Seasons list */}
            {seasons.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl">
                No seasons yet. Add one above.
              </div>
            ) : (
              <div className="border border-slate-900 rounded-xl divide-y divide-slate-900">
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
                          `Delete season "${s.name}"? All teams and matches in this season will also be deleted. This is permanent.`,
                          () => deleteSeason(s.id),
                          'Season deleted.',
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
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
    <div className="p-4 group">
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onUpdate(new FormData(e.currentTarget));
            if (ok) setEditing(false);
          }}
          className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end"
        >
          <Field label="Display Name">
            <input name="displayName" required defaultValue={game.displayName} autoFocus className={input} />
          </Field>
          <Field label="Short Name">
            <input name="shortName" required defaultValue={game.shortName} className={input} />
          </Field>
          <Field label="Image URL">
            <input name="imageUrl" defaultValue={game.imageUrl ?? ''} className={input} />
          </Field>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" disabled={isPending} className={primaryBtn}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className={secondaryBtn}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-bold text-white">{game.displayName}</span>
            <span className="ml-2 text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded uppercase">{game.shortName}</span>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">/games/{game.slug}</div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
            <button onClick={() => setEditing(true)} className={iconBtn} aria-label="Edit game"><FiEdit2 className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className={`${iconBtn} hover:text-red-400`} aria-label="Delete game"><FiTrash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
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
    <div className="p-4 group">
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onUpdate(new FormData(e.currentTarget));
            if (ok) setEditing(false);
          }}
          className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_1fr_auto] gap-3 items-end"
        >
          <Field label="Game">
            <div className={`${input} flex items-center text-slate-300`} aria-readonly="true">
              {gameName}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Game can&apos;t be changed after creation.</p>
            {/* Game is fixed for a season; submit it unchanged so the server action still receives it */}
            <input type="hidden" name="gameId" value={season.gameId} />
          </Field>
          <Field label="Season Name">
            <input name="name" required defaultValue={season.name} autoFocus className={input} />
          </Field>
          <Field label="Active?">
            <select name="isActive" defaultValue={season.isActive ? 'true' : 'false'} className={input}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </Field>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" disabled={isPending} className={primaryBtn}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className={secondaryBtn}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-bold text-white">{season.name}</span>
            <span className="ml-2 text-[10px] text-slate-500">· {gameName}</span>
            <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${season.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
              {season.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
            <button onClick={() => setEditing(true)} className={iconBtn} aria-label="Edit season"><FiEdit2 className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className={`${iconBtn} hover:text-red-400`} aria-label="Delete season"><FiTrash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
