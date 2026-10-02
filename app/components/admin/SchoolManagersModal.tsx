'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import {
  FiUsers,
  FiX,
  FiTrash2,
  FiCheck,
  FiAlertCircle,
  FiUserPlus,
  FiStar,
} from 'react-icons/fi';
import {
  provisionSchoolManager,
  removeSchoolManager,
  getSchoolManagers,
} from '@/app/(admin)/admin/schools/actions';
import { input } from '@/app/components/admin/styles';

interface GameItem {
  id: string;
  displayName: string;
  slug: string;
  name?: string;
}

interface SchoolManagersModalProps {
  school: {
    id: string;
    name: string;
  };
  games?: GameItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ManagerItem {
  id: string;
  schoolId: string;
  userId: string;
  managedGames: string[] | null;
  academicYear: string;
  isPrimaryContact: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  email: string | null;
}

export default function SchoolManagersModal({
  school,
  games = [],
  isOpen,
  onOpenChange,
}: SchoolManagersModalProps) {
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [allGames, setAllGames] = useState(true);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [isSubmitting, startSubmitting] = useTransition();
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);

  // Load managers when modal opens
  const loadManagers = useCallback(async () => {
    if (!school.id) return;
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getSchoolManagers(school.id);
      setManagers(data);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load school managers.');
    } finally {
      setLoading(false);
    }
  }, [school.id]);

  useEffect(() => {
    if (isOpen) {
      loadManagers();
      setFormError(null);
      setFormSuccess(null);
    }
  }, [isOpen, loadManagers]);

  const handleToggleGame = (slug: string) => {
    setSelectedGames((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    );
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!email.trim()) {
      setFormError('Manager email address is required.');
      return;
    }

    const managedGamesPayload = allGames ? undefined : selectedGames;

    startSubmitting(async () => {
      try {
        const res = await provisionSchoolManager({
          schoolId: school.id,
          email: email.trim(),
          academicYear: academicYear.trim(),
          isPrimaryContact,
          managedGames: managedGamesPayload,
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to assign manager.');
          return;
        }

        setFormSuccess(`Successfully assigned ${email.trim()} as manager.`);
        setEmail('');
        setIsPrimaryContact(false);
        setAllGames(true);
        setSelectedGames([]);
        await loadManagers();
      } catch (err: any) {
        setFormError(err.message || 'Unexpected error while assigning manager.');
      }
    });
  };

  const handleRemove = async (managerId: string, managerEmail: string) => {
    if (
      !confirm(
        `Are you sure you want to remove manager access for ${managerEmail}?`
      )
    ) {
      return;
    }

    setIsRemovingId(managerId);
    setFormError(null);
    try {
      const res = await removeSchoolManager({ managerId });
      if (!res.success) {
        setFormError(res.error || 'Failed to remove manager.');
      } else {
        await loadManagers();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to remove manager.');
    } finally {
      setIsRemovingId(null);
    }
  };

  return (
    <Overlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal className="w-full max-w-2xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden my-8">
        <Dialog className="flex flex-col max-h-[85vh] outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-raised/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                <FiUsers className="w-5 h-5" />
              </div>
              <div>
                <Heading className="text-base font-bold text-foreground">
                  School Managers
                </Heading>
                <p className="text-xs text-foreground-muted">
                  {school.name} &bull; Portal Access Management
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors"
              aria-label="Close dialog"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status alerts */}
            {fetchError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-red-300 text-xs">
                <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{fetchError}</span>
              </div>
            )}

            {formError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-red-300 text-xs">
                <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs">
                <FiCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Current Managers Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                  Active Managers ({managers.length})
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
                    const displayEmail = m.email || `User: ${m.userId.slice(0, 8)}...`;
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground truncate">
                              {displayEmail}
                            </span>
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
                          onClick={() => handleRemove(m.id, displayEmail)}
                          disabled={isRemovingId === m.id}
                          className="p-1.5 rounded-lg border border-red-900/30 text-red-400 hover:bg-red-950/30 hover:border-red-900/60 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                          title="Remove manager access"
                          aria-label={`Remove manager ${displayEmail}`}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assign New Manager Form */}
            <div className="pt-2">
              <div className="p-4 rounded-xl border border-line bg-surface-raised/40 space-y-4">
                <div className="flex items-center gap-2">
                  <FiUserPlus className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Assign New Manager
                  </h3>
                </div>

                <form onSubmit={handleAssign} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                        Manager Email <span className="text-accent">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="coach@school.edu"
                        required
                        className={input}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                        Academic Year
                      </label>
                      <input
                        type="text"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        placeholder="2025-2026"
                        required
                        className={input}
                      />
                    </div>
                  </div>

                  {/* Scoped Games Selection */}
                  <div>
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                      Game Permissions
                    </label>
                    <div className="flex items-center gap-4 text-xs mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-foreground">
                        <input
                          type="radio"
                          name="gameScope"
                          checked={allGames}
                          onChange={() => setAllGames(true)}
                          className="text-accent focus:ring-accent"
                        />
                        <span>All Games (Full School Access)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-foreground">
                        <input
                          type="radio"
                          name="gameScope"
                          checked={!allGames}
                          onChange={() => setAllGames(false)}
                          className="text-accent focus:ring-accent"
                        />
                        <span>Specific Games Only</span>
                      </label>
                    </div>

                    {!allGames && games.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-line bg-surface-sunken">
                        {games.map((g) => (
                          <label
                            key={g.id}
                            className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedGames.includes(g.slug)}
                              onChange={() => handleToggleGame(g.slug)}
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
                        checked={isPrimaryContact}
                        onChange={(e) => setIsPrimaryContact(e.target.checked)}
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Designate as primary school contact for this academic year</span>
                    </label>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !email.trim()}
                      className="px-4 py-2 bg-accent text-on-accent text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <FiUserPlus className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Assigning...' : 'Assign Manager'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
