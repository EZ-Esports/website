'use client';

import { FiStar, FiTrash2 } from 'react-icons/fi';
import type { ManagerItem } from './types';
import { chip, deleteIconBtn } from '../styles';


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
                  className={deleteIconBtn}
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
