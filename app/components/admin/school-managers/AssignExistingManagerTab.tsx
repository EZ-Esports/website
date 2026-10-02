'use client';

import { useState, useTransition } from 'react';
import { FiUserPlus, FiSearch, FiX } from 'react-icons/fi';
import {
  assignExistingManager,
  type RegisteredManagerAccount,
} from '@/app/(admin)/admin/schools/manager-actions';
import { input } from '@/app/components/admin/styles';
import type { GameItem } from './types';

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
      <div className="p-4 rounded-xl border border-line bg-surface-raised/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUserPlus className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Assign Existing Registered Manager
            </h3>
          </div>
          <span className="text-[11px] text-foreground-muted">
            {registeredManagers.length} registered {registeredManagers.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>

        {/* Search bar */}
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-3 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            id="manager-search-input"
            type="text"
            value={managerSearchQuery}
            onChange={(e) => setManagerSearchQuery(e.target.value)}
            placeholder="Search registered accounts by name, email, or school..."
            aria-label="Search registered manager accounts"
            className={`${input} pl-10 pr-8 text-xs`}
          />
          {managerSearchQuery && (
            <button
              type="button"
              onClick={() => setManagerSearchQuery('')}
              className="absolute right-3 top-3 text-foreground-muted hover:text-foreground text-xs"
              aria-label="Clear search input"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selected Manager Highlight */}
        {selectedManager ? (
          <div className="p-3.5 rounded-xl border border-accent/40 bg-accent/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-accent text-on-accent font-bold text-xs flex items-center justify-center shrink-0">
                {(selectedManager.firstName?.[0] || selectedManager.fullName?.[0] || 'M').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-xs truncate">
                    {selectedManager.fullName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/20 text-accent font-medium">
                    Selected
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted truncate">
                  {selectedManager.email}
                </p>
                {selectedManager.schools.length > 0 && (
                  <p className="text-[10px] text-foreground-muted/80 truncate">
                    Current Schools: {selectedManager.schools.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedManager(null)}
              className="px-2.5 py-1 text-xs text-foreground-muted hover:text-foreground border border-line rounded-lg hover:bg-surface transition-colors shrink-0 cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          /* Search results list */
          <div className="space-y-2">
            <span className="block text-[11px] font-bold text-foreground-secondary uppercase tracking-wider">
              Select a Manager Account:
            </span>

            {filteredManagers.length === 0 ? (
              <div className="p-4 rounded-xl border border-line/60 bg-surface-raised/20 text-center text-xs text-foreground-muted space-y-1">
                <p>
                  {managerSearchQuery
                    ? `No registered managers found matching "${managerSearchQuery}".`
                    : 'No registered manager accounts available.'}
                </p>
                <p className="text-[11px] text-foreground-muted/70">
                  To invite a new manager, use the{' '}
                  <button
                    type="button"
                    onClick={onSwitchToInvites}
                    className="text-accent underline font-semibold cursor-pointer"
                  >
                    Provision Invite Link
                  </button>{' '}
                  tab.
                </p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-line/40 rounded-xl border border-line/60 bg-surface-raised/20">
                {filteredManagers.map((m) => (
                  <div
                    key={m.email}
                    onClick={() => setSelectedManager(m)}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-surface-raised/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-surface-sunken border border-line text-foreground-secondary font-bold text-xs flex items-center justify-center shrink-0">
                        {(m.firstName?.[0] || m.fullName?.[0] || 'M').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-xs truncate">
                          {m.fullName}
                        </p>
                        <p className="text-[11px] text-foreground-muted truncate">
                          {m.email}
                        </p>
                        {m.schools.length > 0 && (
                          <p className="text-[10px] text-foreground-muted/70 truncate">
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
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface border border-line text-foreground hover:border-accent hover:text-accent transition-colors shrink-0 cursor-pointer"
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
                className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1"
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
              <span className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                Game Permissions
              </span>
              <div className="flex items-center gap-4 text-xs mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="assignGameScope"
                    checked={assignAllGames}
                    onChange={() => setAssignAllGames(true)}
                    className="text-accent focus:ring-accent"
                  />
                  <span>All Games (Full School Access)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="assignGameScope"
                    checked={!assignAllGames}
                    onChange={() => setAssignAllGames(false)}
                    className="text-accent focus:ring-accent"
                  />
                  <span>Specific Games Only</span>
                </label>
              </div>

              {!assignAllGames && games.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-line bg-surface-sunken">
                  {games.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assignSelectedGames.includes(g.slug)}
                        onChange={() => handleToggleAssignGame(g.slug)}
                        className="rounded border-line text-accent focus:ring-accent"
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
                  className="rounded border-line text-accent focus:ring-accent"
                />
                <span>Designate as primary school contact for this academic year</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-accent text-on-accent text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
