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
  FiLink,
  FiCopy,
  FiClock,
  FiCheckCircle,
} from 'react-icons/fi';
import {
  provisionSchoolManager,
  removeSchoolManager,
  getSchoolManagers,
  generateManagerInvite,
  getSchoolManagerInvites,
  revokeManagerInvite,
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
    slug?: string;
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

interface ManagerInviteItem {
  id: string;
  schoolId: string;
  intendedFirstName: string;
  intendedLastName: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  submittedAt: Date | null;
  submissionDraft: any;
}

export default function SchoolManagersModal({
  school,
  games = [],
  isOpen,
  onOpenChange,
}: SchoolManagersModalProps) {
  const [activeTab, setActiveTab] = useState<'invites' | 'active' | 'direct'>('invites');

  // Managers & Invites State
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [invites, setInvites] = useState<ManagerInviteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Invite Provisioning Form State
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteYear, setInviteYear] = useState('2025-2026');
  const [inviteAllGames, setInviteAllGames] = useState(true);
  const [inviteSelectedGames, setInviteSelectedGames] = useState<string[]>([]);
  const [inviteIsPrimary, setInviteIsPrimary] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Direct Assign Form State
  const [directEmail, setDirectEmail] = useState('');
  const [directYear, setDirectYear] = useState('2025-2026');
  const [directIsPrimary, setDirectIsPrimary] = useState(false);
  const [directAllGames, setDirectAllGames] = useState(true);
  const [directSelectedGames, setDirectSelectedGames] = useState<string[]>([]);

  // Action feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);

  // Load managers & invites
  const loadData = useCallback(async () => {
    if (!school.id) return;
    setLoading(true);
    setFetchError(null);
    try {
      const [mgrs, invs] = await Promise.all([
        getSchoolManagers(school.id),
        getSchoolManagerInvites(school.id),
      ]);
      setManagers(mgrs);
      setInvites(invs);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load school manager records.');
    } finally {
      setLoading(false);
    }
  }, [school.id]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setFormError(null);
      setFormSuccess(null);
      setGeneratedUrl(null);
      setCopiedUrl(false);
    }
  }, [isOpen, loadData]);

  const handleToggleInviteGame = (slug: string) => {
    setInviteSelectedGames((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    );
  };

  const handleToggleDirectGame = (slug: string) => {
    setDirectSelectedGames((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    );
  };

  // Generate Invite Link
  const handleGenerateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setGeneratedUrl(null);

    if (!inviteFirstName.trim() || !inviteLastName.trim()) {
      setFormError('Manager first name and last name are required.');
      return;
    }

    startSubmitting(async () => {
      try {
        const res = await generateManagerInvite({
          schoolId: school.id,
          firstName: inviteFirstName.trim(),
          lastName: inviteLastName.trim(),
          email: inviteEmail.trim() || undefined,
          academicYear: inviteYear.trim(),
          managedGames: inviteAllGames ? null : inviteSelectedGames,
          isPrimaryContact: inviteIsPrimary,
        });

        if (!res.success || !res.inviteUrl) {
          setFormError(res.error || 'Failed to generate manager invite link.');
          return;
        }

        const fullUrl = `${window.location.origin}${res.inviteUrl}`;
        setGeneratedUrl(fullUrl);
        setFormSuccess(`Onboarding invite created for ${inviteFirstName.trim()} ${inviteLastName.trim()}!`);
        setInviteFirstName('');
        setInviteLastName('');
        setInviteEmail('');
        await loadData();
      } catch (err: any) {
        setFormError(err.message || 'Unexpected error generating invite.');
      }
    });
  };

  // Direct Assign
  const handleDirectAssign = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!directEmail.trim()) {
      setFormError('Manager email address is required.');
      return;
    }

    startSubmitting(async () => {
      try {
        const res = await provisionSchoolManager({
          schoolId: school.id,
          email: directEmail.trim(),
          academicYear: directYear.trim(),
          isPrimaryContact: directIsPrimary,
          managedGames: directAllGames ? undefined : directSelectedGames,
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to assign manager.');
          return;
        }

        setFormSuccess(`Successfully assigned ${directEmail.trim()} as manager.`);
        setDirectEmail('');
        setDirectIsPrimary(false);
        setDirectAllGames(true);
        setDirectSelectedGames([]);
        await loadData();
      } catch (err: any) {
        setFormError(err.message || 'Unexpected error while assigning manager.');
      }
    });
  };

  // Remove Manager Access
  const handleRemove = async (managerId: string, managerEmail: string) => {
    if (!confirm(`Are you sure you want to remove manager access for ${managerEmail}?`)) {
      return;
    }

    setIsRemovingId(managerId);
    setFormError(null);
    try {
      const res = await removeSchoolManager({ managerId });
      if (!res.success) {
        setFormError(res.error || 'Failed to remove manager.');
      } else {
        await loadData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to remove manager.');
    } finally {
      setIsRemovingId(null);
    }
  };

  // Revoke Manager Invite
  const handleRevokeInvite = async (inviteId: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke the invite for ${name}?`)) {
      return;
    }

    setIsRevokingId(inviteId);
    setFormError(null);
    try {
      const res = await revokeManagerInvite(inviteId);
      if (!res.success) {
        setFormError(res.error || 'Failed to revoke invite.');
      } else {
        await loadData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to revoke invite.');
    } finally {
      setIsRevokingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
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

          {/* Navigation Tabs */}
          <div className="flex border-b border-line bg-surface px-6 pt-2 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('invites');
                setFormError(null);
                setFormSuccess(null);
              }}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'invites'
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <FiLink className="w-3.5 h-3.5" />
              Provision Invite Link
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('active');
                setFormError(null);
                setFormSuccess(null);
              }}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <FiUsers className="w-3.5 h-3.5" />
              Active Managers ({managers.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('direct');
                setFormError(null);
                setFormSuccess(null);
              }}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'direct'
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <FiUserPlus className="w-3.5 h-3.5" />
              Direct Assign
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

            {/* TAB 1: PROVISION INVITE LINK */}
            {activeTab === 'invites' && (
              <div className="space-y-6">
                {/* Generated URL Card */}
                {generatedUrl && (
                  <div className="p-4 rounded-xl border border-accent/40 bg-accent/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <FiCheckCircle className="w-4 h-4" /> Manager Invite Link Ready
                      </span>
                      <span className="text-[11px] text-foreground-muted">Valid for 14 days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedUrl}
                        className="flex-1 px-3 py-2 bg-surface text-foreground rounded-lg border border-border text-xs font-mono select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedUrl)}
                        className="px-3.5 py-2 bg-accent text-on-accent rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        {copiedUrl ? (
                          <>
                            <FiCheck className="w-3.5 h-3.5" /> Copied!
                          </>
                        ) : (
                          <>
                            <FiCopy className="w-3.5 h-3.5" /> Copy Link
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-foreground-muted">
                      Send this link to the school manager. They will complete verification, set their password, and gain instant access to the School Manager Portal.
                    </p>
                  </div>
                )}

                {/* Provisioning Form */}
                <div className="p-4 rounded-xl border border-line bg-surface-raised/40 space-y-4">
                  <div className="flex items-center gap-2">
                    <FiLink className="w-4 h-4 text-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Provision Manager Invite Link
                    </h3>
                  </div>

                  <form onSubmit={handleGenerateInvite} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                          First Name <span className="text-accent">*</span>
                        </label>
                        <input
                          type="text"
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          placeholder="e.g. Alex"
                          required
                          className={input}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                          Last Name <span className="text-accent">*</span>
                        </label>
                        <input
                          type="text"
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          placeholder="e.g. Miller"
                          required
                          className={input}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                          Expected Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="coach@school.edu"
                          className={input}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                          Academic Year
                        </label>
                        <input
                          type="text"
                          value={inviteYear}
                          onChange={(e) => setInviteYear(e.target.value)}
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
                            name="inviteGameScope"
                            checked={inviteAllGames}
                            onChange={() => setInviteAllGames(true)}
                            className="text-accent focus:ring-accent"
                          />
                          <span>All Games (Full School Access)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-foreground">
                          <input
                            type="radio"
                            name="inviteGameScope"
                            checked={!inviteAllGames}
                            onChange={() => setInviteAllGames(false)}
                            className="text-accent focus:ring-accent"
                          />
                          <span>Specific Games Only</span>
                        </label>
                      </div>

                      {!inviteAllGames && games.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-line bg-surface-sunken">
                          {games.map((g) => (
                            <label
                              key={g.id}
                              className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={inviteSelectedGames.includes(g.slug)}
                                onChange={() => handleToggleInviteGame(g.slug)}
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
                          checked={inviteIsPrimary}
                          onChange={(e) => setInviteIsPrimary(e.target.checked)}
                          className="rounded border-line text-accent focus:ring-accent"
                        />
                        <span>Designate as primary school contact for this academic year</span>
                      </label>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || !inviteFirstName.trim() || !inviteLastName.trim()}
                        className="px-4 py-2 bg-accent text-on-accent text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <FiLink className="w-3.5 h-3.5" />
                        {isSubmitting ? 'Generating...' : 'Generate Manager Invite Link'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Recent & Pending Manager Invites List */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary mb-3">
                    Manager Invites ({invites.length})
                  </h3>

                  {invites.length === 0 ? (
                    <div className="p-4 rounded-xl border border-line/60 bg-surface-raised/20 text-center text-xs text-foreground-muted">
                      No manager invites generated yet for this school.
                    </div>
                  ) : (
                    <div className="divide-y divide-line/40 rounded-xl border border-line/60 bg-surface-raised/20 overflow-hidden">
                      {invites.map((inv) => {
                        const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
                        const statusColor =
                          inv.status === 'accepted'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : inv.status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : isExpired
                            ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

                        return (
                          <div
                            key={inv.id}
                            className="p-3.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {inv.intendedFirstName} {inv.intendedLastName}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}
                                >
                                  {isExpired && inv.status === 'pending' ? 'Expired' : inv.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-foreground-muted">
                                Created {new Date(inv.createdAt).toLocaleDateString()} &bull; Expires{' '}
                                {new Date(inv.expiresAt).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {inv.status === 'pending' && !isExpired && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRevokeInvite(
                                      inv.id,
                                      `${inv.intendedFirstName} ${inv.intendedLastName}`
                                    )
                                  }
                                  disabled={isRevokingId === inv.id}
                                  className="px-2.5 py-1 text-xs border border-rose-900/40 text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors disabled:opacity-40"
                                >
                                  {isRevokingId === inv.id ? 'Revoking...' : 'Revoke'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ACTIVE MANAGERS */}
            {activeTab === 'active' && (
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
            )}

            {/* TAB 3: DIRECT ASSIGN */}
            {activeTab === 'direct' && (
              <div className="p-4 rounded-xl border border-line bg-surface-raised/40 space-y-4">
                <div className="flex items-center gap-2">
                  <FiUserPlus className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Direct Email Assignment
                  </h3>
                </div>

                <form onSubmit={handleDirectAssign} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                        Manager Email <span className="text-accent">*</span>
                      </label>
                      <input
                        type="email"
                        value={directEmail}
                        onChange={(e) => setDirectEmail(e.target.value)}
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
                        value={directYear}
                        onChange={(e) => setDirectYear(e.target.value)}
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
                          name="directGameScope"
                          checked={directAllGames}
                          onChange={() => setDirectAllGames(true)}
                          className="text-accent focus:ring-accent"
                        />
                        <span>All Games (Full School Access)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-foreground">
                        <input
                          type="radio"
                          name="directGameScope"
                          checked={!directAllGames}
                          onChange={() => setDirectAllGames(false)}
                          className="text-accent focus:ring-accent"
                        />
                        <span>Specific Games Only</span>
                      </label>
                    </div>

                    {!directAllGames && games.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-line bg-surface-sunken">
                        {games.map((g) => (
                          <label
                            key={g.id}
                            className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={directSelectedGames.includes(g.slug)}
                              onChange={() => handleToggleDirectGame(g.slug)}
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
                        checked={directIsPrimary}
                        onChange={(e) => setDirectIsPrimary(e.target.checked)}
                        className="rounded border-line text-accent focus:ring-accent"
                      />
                      <span>Designate as primary school contact for this academic year</span>
                    </label>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !directEmail.trim()}
                      className="px-4 py-2 bg-accent text-on-accent text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <FiUserPlus className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Assigning...' : 'Assign Manager Directly'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </Dialog>
      </Modal>
    </Overlay>
  );
}
