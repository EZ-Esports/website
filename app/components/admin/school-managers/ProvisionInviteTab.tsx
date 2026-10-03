'use client';

import { useState, useTransition } from 'react';
import {
  FiLink,
  FiCheckCircle,
  FiCheck,
  FiCopy,
} from 'react-icons/fi';
import { generateManagerInvite } from '@/app/(admin)/admin/schools/manager-actions';
import { input } from '@/app/components/admin/styles';
import type { GameItem, ManagerInviteItem } from './types';

interface ProvisionInviteTabProps {
  schoolId: string;
  games: GameItem[];
  invites: ManagerInviteItem[];
  isRevokingId: string | null;
  onRevokeInvite: (id: string, name: string) => Promise<any>;
  onRefresh: () => Promise<void>;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string | null) => void;
}

export function ProvisionInviteTab({
  schoolId,
  games,
  invites,
  isRevokingId,
  onRevokeInvite,
  onRefresh,
  onError,
  onSuccess,
}: ProvisionInviteTabProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [allGames, setAllGames] = useState(true);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [now] = useState(() => Date.now());
  const [isSubmitting, startSubmitting] = useTransition();

  const handleToggleGame = (slug: string) => {
    setSelectedGames((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Gracefully handle clipboard write rejection
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    onSuccess(null);
    setGeneratedUrl(null);

    if (!firstName.trim() || !lastName.trim()) {
      onError('Manager first name and last name are required.');
      return;
    }

    startSubmitting(async () => {
      try {
        const res = await generateManagerInvite({
          schoolId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          academicYear: academicYear.trim(),
          managedGames: allGames ? null : selectedGames,
          isPrimaryContact,
        });

        if (!res.success || !res.inviteUrl) {
          onError(res.error || 'Failed to generate manager invite link.');
          return;
        }

        const fullUrl = `${window.location.origin}${res.inviteUrl}`;
        setGeneratedUrl(fullUrl);
        onSuccess(`Onboarding invite created for ${firstName.trim()} ${lastName.trim()}!`);
        setFirstName('');
        setLastName('');
        setEmail('');
        await onRefresh();
      } catch (err: any) {
        onError(err.message || 'Unexpected error generating invite.');
      }
    });
  };

  return (
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
              aria-label="Generated manager invite URL"
              className="flex-1 px-3 py-2 bg-surface text-foreground rounded-lg border border-border text-xs font-mono select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(generatedUrl)}
              className="px-3.5 py-2 bg-accent text-on-accent rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors flex items-center gap-1.5 shrink-0"
              aria-label="Copy invite link to clipboard"
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="invite-first-name"
                className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1"
              >
                First Name <span className="text-accent">*</span>
              </label>
              <input
                id="invite-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Alex"
                required
                className={input}
              />
            </div>
            <div>
              <label
                htmlFor="invite-last-name"
                className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1"
              >
                Last Name <span className="text-accent">*</span>
              </label>
              <input
                id="invite-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Miller"
                required
                className={input}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="invite-email"
                className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1"
              >
                Expected Email (Optional)
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@school.edu"
                className={input}
              />
            </div>
            <div>
              <label
                htmlFor="invite-year"
                className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1"
              >
                Academic Year
              </label>
              <input
                id="invite-year"
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
            <span className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
              Game Permissions
            </span>
            <div className="flex items-center gap-4 text-xs mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <input
                  type="radio"
                  name="inviteGameScope"
                  checked={allGames}
                  onChange={() => setAllGames(true)}
                  className="text-accent focus:ring-accent"
                />
                <span>All Games (Full School Access)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <input
                  type="radio"
                  name="inviteGameScope"
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
              disabled={isSubmitting || !firstName.trim() || !lastName.trim()}
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
              const isExpired = inv.expiresAt ? new Date(inv.expiresAt).getTime() < now : false;
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
                      {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'Never'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === 'pending' && !isExpired && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await onRevokeInvite(
                            inv.id,
                            `${inv.intendedFirstName} ${inv.intendedLastName}`
                          );
                          if (!res?.success && res?.error) {
                            onError(res.error);
                          }
                        }}
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
  );
}
