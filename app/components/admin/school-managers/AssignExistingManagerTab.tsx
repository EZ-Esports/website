'use client';

import { useState, useTransition } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import {
  assignExistingManager,
  type RegisteredManagerAccount,
} from '@/app/(admin)/admin/schools/manager-actions';
import { input } from '@/app/components/admin/styles';
import type { GameItem } from './types';
import { chip, label as labelClass, labelText, primaryBtn, secondaryBtnSm, textLinkSm } from '../styles';
import { AdminSearchField } from '../AdminUI';

interface AssignExistingManagerTabProps {
  school: {
    id: string;
    name: string;
  };
  games: GameItem[];
  registeredManagers: RegisteredManagerAccount[];
  onSwitchToInvites: () => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string | null) => void;
}

export function AssignExistingManagerTab({
  school,
  games,
  registeredManagers,
  onSwitchToInvites,
  onRefresh,
  onError,
  onSuccess,
}: AssignExistingManagerTabProps) {
  const [managerSearchQuery, setManagerSearchQuery] = useState('');
  const [selectedManager, setSelectedManager] = useState<RegisteredManagerAccount | null>(null);
  const [assignYear, setAssignYear] = useState('2025-2026');
  const [assignIsPrimary, setAssignIsPrimary] = useState(false);
  const [assignAllGames, setAssignAllGames] = useState(true);
  const [assignSelectedGames, setAssignSelectedGames] = useState<string[]>([]);
  const [isSubmitting, startSubmitting] = useTransition();

  const handleToggleAssignGame = (slug: string) => {
    setAssignSelectedGames((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    );
  };

  const handleAssignExistingManager = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    onSuccess(null);

    if (!selectedManager) {
      onError('Please select a registered manager account.');
      return;
    }

    startSubmitting(async () => {
      try {
        const res = await assignExistingManager({
          schoolId: school.id,
          userId: selectedManager.userId || undefined,
          memberId: selectedManager.memberId ?? undefined,
          email: selectedManager.email,
          academicYear: assignYear.trim(),
          isPrimaryContact: assignIsPrimary,
          managedGames: assignAllGames ? null : assignSelectedGames,
        });

        if (!res.success) {
          onError(res.error || 'Failed to assign manager.');
          return;
        }

        onSuccess(
          `Successfully assigned ${selectedManager.fullName} (${selectedManager.email}) as manager for ${school.name}.`
        );
        setSelectedManager(null);
        setAssignIsPrimary(false);
        setAssignAllGames(true);
        setAssignSelectedGames([]);
        await onRefresh();
      } catch (err: any) {
        onError(err.message || 'Unexpected error while assigning manager.');
      }
    });
  };

  const filteredManagers = registeredManagers.filter((m) => {
    if (!managerSearchQuery.trim()) return true;
    const q = managerSearchQuery.toLowerCase().trim();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.schools.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-sunken/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUserPlus className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">
              Assign Existing Registered Manager
            </h3>
          </div>
          <span className="text-xs text-foreground-secondary">
            {registeredManagers.length} registered {registeredManagers.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>

        {/* Search bar */}
        <AdminSearchField
          id="manager-search-input"
          value={managerSearchQuery}
          onChange={(e) => setManagerSearchQuery(e.target.value)}
          onClear={() => setManagerSearchQuery('')}
          placeholder="Search registered accounts by name, email, or school..."
          aria-label="Search registered manager accounts"
        />

        {/* Selected Manager Highlight */}
        {selectedManager ? (
          <div className="admin-fade-in flex items-center justify-between gap-3 rounded-xl bg-accent/10 p-3.5 ring-1 ring-accent/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-accent text-on-accent font-bold text-xs flex items-center justify-center shrink-0">
                {(selectedManager.firstName?.[0] || selectedManager.fullName?.[0] || 'M').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm truncate">
                    {selectedManager.fullName}
                  </span>
                  <span className={chip('accent', 'sm')}>
                    Selected
                  </span>
                </div>
                <p className="text-xs text-foreground-secondary truncate">
                  {selectedManager.email}
                </p>
                {selectedManager.schools.length > 0 && (
                  <p className="text-xs text-foreground-secondary truncate">
                    Current Schools: {selectedManager.schools.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedManager(null)}
              className={secondaryBtnSm}
            >
              Change
            </button>
          </div>
        ) : (
          /* Search results list */
          <div className="space-y-2">
            <span className={labelText}>
              Select a Manager Account:
            </span>

            {filteredManagers.length === 0 ? (
              <div className="rounded-xl bg-surface-sunken/60 p-4 text-center text-sm text-foreground-secondary space-y-1">
                <p>
                  {managerSearchQuery
                    ? `No registered managers found matching "${managerSearchQuery}".`
                    : 'No registered manager accounts available.'}
                </p>
                <p className="text-xs text-foreground-secondary/70">
                  To invite a new manager, use the{' '}
                  <button
                    type="button"
                    onClick={onSwitchToInvites}
                    className={textLinkSm}
                  >
                    Provision Invite Link
                  </button>{' '}
                  tab.
                </p>
              </div>
            ) : (
              <div className="admin-scroll max-h-56 overflow-y-auto divide-y divide-line/50 rounded-xl bg-surface-sunken/60">
                {filteredManagers.map((m) => (
                  <div
                    key={m.email}
                    onClick={() => setSelectedManager(m)}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-surface-raised/60 transition-colors cursor-pointer outline-none focus-visible:bg-surface-raised/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-surface-raised text-foreground-secondary font-bold text-xs flex items-center justify-center shrink-0">
                        {(m.firstName?.[0] || m.fullName?.[0] || 'M').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          {m.fullName}
                        </p>
                        <p className="text-xs text-foreground-secondary truncate">
                          {m.email}
                        </p>
                        {m.schools.length > 0 && (
                          <p className="text-xs text-foreground-secondary truncate">
                            {m.schools.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedManager(m);
                      }}
                      className={secondaryBtnSm}
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form configuration fields for selected manager */}
        {selectedManager && (
          <form onSubmit={handleAssignExistingManager} className="space-y-4 pt-2 border-t border-line/50">
            <div>
              <label
                htmlFor="assign-year"
                className={labelClass}
              >
                Academic Year
              </label>
              <input
                id="assign-year"
                type="text"
                value={assignYear}
                onChange={(e) => setAssignYear(e.target.value)}
                placeholder="2025-2026"
                required
                className={input}
              />
            </div>

            {/* Scoped Games Selection */}
            <div>
              <span className={labelClass}>
                Game Permissions
              </span>
              <div className="flex items-center gap-4 text-xs mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="assignGameScope"
                    checked={assignAllGames}
                    onChange={() => setAssignAllGames(true)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span>All Games (Full School Access)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="assignGameScope"
                    checked={!assignAllGames}
                    onChange={() => setAssignAllGames(false)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span>Specific Games Only</span>
                </label>
              </div>

              {!assignAllGames && games.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg bg-surface-sunken p-3">
                  {games.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assignSelectedGames.includes(g.slug)}
                        onChange={() => handleToggleAssignGame(g.slug)}
                        className="h-4 w-4 accent-accent"
                      />
                      <span>{g.displayName || g.name || g.slug}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Contact Checkbox */}
            <div>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignIsPrimary}
                  onChange={(e) => setAssignIsPrimary(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                <span>Designate as primary school contact for this academic year</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className={primaryBtn}
              >
                <FiUserPlus className="w-3.5 h-3.5" />
                {isSubmitting
                  ? 'Assigning...'
                  : `Assign ${selectedManager.firstName || selectedManager.fullName} to School`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
