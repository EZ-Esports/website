'use client';

import { FiStar, FiTrash2 } from 'react-icons/fi';
import type { ManagerItem } from './types';

interface ActiveManagersTabProps {
  managers: ManagerItem[];
  loading: boolean;
  isRemovingId: string | null;
  onRemoveManager: (id: string, name: string) => Promise<any>;
  onError: (msg: string | null) => void;
}

export function ActiveManagersTab({
  managers,
  loading,
  isRemovingId,
  onRemoveManager,
  onError,
}: ActiveManagersTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">
          Active Portal Managers ({managers.length})
        </h3>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-foreground-muted">
          Loading managers...
        </div>
      ) : managers.length === 0 ? (
        <div className="p-4 rounded-xl border border-line/60 bg-surface-raised/20 text-center text-xs text-foreground-muted">
          No portal managers currently assigned to this school.
        </div>
      ) : (
        <div className="divide-y divide-line/40 rounded-xl border border-line/60 bg-surface-raised/20 overflow-hidden">
          {managers.map((m) => {
            const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
            const displayEmail = m.email || `User: ${m.userId.slice(0, 8)}...`;
            return (
              <div
                key={m.id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {displayName ? (
                      <>
                        <span className="font-semibold text-foreground">
                          {displayName}
                        </span>
                        <span className="text-[11px] text-foreground-muted">
                          &bull; {displayEmail}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-foreground truncate">
                        {displayEmail}
                      </span>
                    )}
                    {m.isPrimaryContact && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <FiStar className="w-2.5 h-2.5 fill-current" /> Primary
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] bg-surface-sunken text-foreground-muted border border-line">
                      {m.academicYear}
                    </span>
                  </div>

                  <div className="text-[11px] text-foreground-muted flex items-center gap-1.5 flex-wrap">
                    <span>Games:</span>
                    {!m.managedGames || m.managedGames.length === 0 ? (
                      <span className="text-foreground-secondary font-medium">
                        All Games
                      </span>
                    ) : (
                      m.managedGames.map((g) => (
                        <span
                          key={g}
                          className="px-1.5 py-0.5 rounded bg-surface border border-line text-[10px] font-medium uppercase tracking-wider"
                        >
                          {g}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await onRemoveManager(m.id, displayName || displayEmail);
                    if (!res?.success && res?.error) {
                      onError(res.error);
                    }
                  }}
                  disabled={isRemovingId === m.id}
                  className="p-1.5 rounded-lg border border-red-900/30 text-red-400 hover:bg-red-950/30 hover:border-red-900/60 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                  title="Remove manager access"
                  aria-label={`Remove manager ${displayName || displayEmail}`}
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
