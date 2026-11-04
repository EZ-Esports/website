'use client';

import { useState } from 'react';
import { FiStar, FiTrash2 } from 'react-icons/fi';
import ConfirmActionDialog from '../ConfirmActionDialog';
import { useConfirmAction } from '../useConfirmAction';
import ContentFlagBadge from '../ContentFlagBadge';
import RowIconButton from '../RowIconButton';
import type { ContentFlagView } from '@/app/lib/db/content-flags';
import type { GameItem, ManagerItem } from './types';
import { chip, deleteIconBtn, saveBtn, cancelBtn } from '../styles';

type SaveResult = { success: boolean; error?: string };

/** Inline editor for one manager's game scope and primary-contact flag. */
function ManagerAccessEditor({
  manager,
  games,
  onSave,
  onCancel,
}: {
  manager: ManagerItem;
  games: GameItem[];
  onSave: (managedGames: string[] | null, isPrimaryContact: boolean) => Promise<SaveResult>;
  onCancel: () => void;
}) {
  const [allGames, setAllGames] = useState(!manager.managedGames || manager.managedGames.length === 0);
  const [selected, setSelected] = useState<string[]>(manager.managedGames ?? []);
  const [primary, setPrimary] = useState(manager.isPrimaryContact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (slug: string) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]));

  const save = async () => {
    if (!allGames && selected.length === 0) {
      setError('Choose at least one game, or allow all games.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSave(allGames ? null : selected, primary);
    setSaving(false);
    if (res.success) onCancel();
    else setError(res.error || 'Could not save changes.');
  };

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-surface-raised/60 p-3">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-foreground-secondary">Games this manager can manage</legend>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input type="radio" name={`scope-${manager.id}`} checked={allGames} onChange={() => setAllGames(true)} className="h-4 w-4 accent-accent" />
          All games
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input type="radio" name={`scope-${manager.id}`} checked={!allGames} onChange={() => setAllGames(false)} className="h-4 w-4 accent-accent" />
          Specific games only
        </label>
        {!allGames && (
          <div className="grid grid-cols-2 gap-2 pl-6 sm:grid-cols-3">
            {games.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer">
                <input type="checkbox" checked={selected.includes(g.slug)} onChange={() => toggle(g.slug)} className="h-4 w-4 accent-accent" />
                {g.displayName || g.name || g.slug}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
        <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="h-4 w-4 accent-accent" />
        Primary school contact for {manager.academicYear}
      </label>
      {error && <p role="alert" className="text-xs text-danger-on-tint">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className={saveBtn}>{saving ? 'Saving…' : 'Save access'}</button>
        <button type="button" onClick={onCancel} disabled={saving} className={cancelBtn}>Cancel</button>
      </div>
    </div>
  );
}


interface ActiveManagersTabProps {
  managers: ManagerItem[];
  /** Onboarding content-flag overrides by member id; empty when none or not migrated yet. */
  contentFlags?: Record<string, ContentFlagView[]>;
  loading: boolean;
  isRemovingId: string | null;
  onRemoveManager: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Games offered when scoping a manager; the edit control is hidden without `onUpdateManager`. */
  games?: GameItem[];
  onUpdateManager?: (id: string, managedGames: string[] | null, isPrimaryContact: boolean) => Promise<SaveResult>;
  onSuccess?: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}

export function ActiveManagersTab({
  managers,
  contentFlags = {},
  loading,
  isRemovingId,
  onRemoveManager,
  games = [],
  onUpdateManager,
  onSuccess,
  onError,
}: ActiveManagersTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const removal = useConfirmAction<{ id: string; name: string }>(async ({ id }) => {
    const res = await onRemoveManager(id);
    if (!res?.success && res?.error) onError(res.error);
    return res;
  }, 'Failed to remove manager.');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Active Portal Managers ({managers.length})
        </h3>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-foreground-secondary" role="status">
          Loading managers...
        </div>
      ) : managers.length === 0 ? (
        <div className="rounded-xl bg-surface-sunken/60 p-4 text-center text-sm text-foreground-secondary">
          No portal managers currently assigned to this school.
        </div>
      ) : (
        <div className="admin-stagger divide-y divide-line/50 overflow-hidden rounded-xl bg-surface-sunken/60">
          {managers.map((m) => {
            const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
            const displayEmail = m.email || `User: ${m.userId.slice(0, 8)}...`;
            return (
              <div key={m.id} className="p-3.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {displayName ? (
                      <>
                        <span className="font-semibold text-foreground">
                          {displayName}
                        </span>
                        <span className="text-xs text-foreground-secondary">
                          &bull; {displayEmail}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-foreground truncate">
                        {displayEmail}
                      </span>
                    )}
                    {m.isPrimaryContact && (
                      <span className={chip('warning', 'sm')}>
                        <FiStar className="w-2.5 h-2.5 fill-current" /> Primary
                      </span>
                    )}
                    <span className={chip('neutral', 'sm')}>
                      {m.academicYear}
                    </span>
                  </div>

                  <div className="text-xs text-foreground-secondary flex items-center gap-1.5 flex-wrap">
                    <span>Games:</span>
                    {!m.managedGames || m.managedGames.length === 0 ? (
                      <span className="text-foreground-secondary font-medium">
                        All Games
                      </span>
                    ) : (
                      m.managedGames.map((g) => (
                        <span
                          key={g}
                          className={chip('neutral', 'sm')}
                        >
                          {g}
                        </span>
                      ))
                    )}
                  </div>
                  {(m.schoolEmail || m.hasStudentId) && (
                    <div className="text-xs text-foreground-secondary flex items-center gap-x-3 gap-y-1 flex-wrap">
                      {m.schoolEmail && <span>School email: {m.schoolEmail}</span>}
                      {m.hasStudentId && m.memberId && (
                        <a
                          href={`/admin/schools/student-id/${m.memberId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-accent underline underline-offset-2"
                        >
                          View student ID<span className="sr-only"> for {displayName || displayEmail} (opens in a new tab)</span>
                        </a>
                      )}
                    </div>
                  )}
                  {m.memberId &&
                    (contentFlags[m.memberId] ?? []).map((flag) => (
                      <ContentFlagBadge key={flag.id} flag={flag} who={displayName || displayEmail} />
                    ))}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {onUpdateManager && (
                    <RowIconButton
                      kind="edit"
                      onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                      label={`Edit access for ${displayName || displayEmail}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removal.request({ id: m.id, name: displayName || displayEmail })}
                    disabled={isRemovingId === m.id}
                    className={deleteIconBtn}
                    title="Remove manager access"
                    aria-label={`Remove manager ${displayName || displayEmail}`}
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
                </div>
                {onUpdateManager && editingId === m.id && (
                  <ManagerAccessEditor
                    manager={m}
                    games={games}
                    onCancel={() => setEditingId(null)}
                    onSave={async (g, p) => {
                      const res = await onUpdateManager(m.id, g, p);
                      if (res.success) onSuccess?.(`Access updated for ${displayName || displayEmail}.`);
                      return res;
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionDialog
        {...removal.dialogProps}
        tone="danger"
        title="Remove manager access?"
        message={`Remove manager access for ${removal.target?.name ?? ''}? They will no longer be able to use the school portal. Their student record and roster spots are not deleted.`}
        confirmLabel="Remove access"
        pendingLabel="Removing…"
      />
    </div>
  );
}
