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
import { adminButton, inputSm, label as labelClass, primaryBtn, primaryBtnSm } from '../styles';
import { RequiredMark } from '../AdminUI';

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
        <div className="admin-fade-in rounded-xl bg-accent/10 p-4 space-y-3 ring-1 ring-accent/30">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
              <FiCheckCircle className="w-4 h-4" /> Manager Invite Link Ready
            </span>
            <span className="text-xs text-foreground-secondary">Valid for 14 days</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedUrl}
              aria-label="Generated manager invite URL"
              className={inputSm + ' flex-1 font-mono select-all'}
            />
            <button
              type="button"
              onClick={() => copyToClipboard(generatedUrl)}
              className={primaryBtnSm}
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
          <p className="text-xs text-foreground-secondary">
            Send this link to the school manager. They will complete verification, set their password, and gain instant access to the School Manager Portal.
          </p>
        </div>
      )}

      {/* Provisioning Form */}
      <div className="rounded-xl bg-surface-sunken/60 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FiLink className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">
            Provision Manager Invite Link
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="invite-first-name"
                className={labelClass}
              >
                First Name <RequiredMark />
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
                className={labelClass}
              >
                Last Name <RequiredMark />
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
                className={labelClass}
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
                className={labelClass}
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
            <span className={labelClass}>
              Game Permissions
            </span>
            <div className="flex items-center gap-4 text-xs mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <input
                  type="radio"
                  name="inviteGameScope"
                  checked={allGames}
                  onChange={() => setAllGames(true)}
                  className="h-4 w-4 accent-accent"
                />
                <span>All Games (Full School Access)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <input
                  type="radio"
                  name="inviteGameScope"
                  checked={!allGames}
                  onChange={() => setAllGames(false)}
                  className="h-4 w-4 accent-accent"
                />
                <span>Specific Games Only</span>
              </label>
            </div>

            {!allGames && games.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg bg-surface-sunken p-3">
                {games.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGames.includes(g.slug)}
                      onChange={() => handleToggleGame(g.slug)}
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
                checked={isPrimaryContact}
                onChange={(e) => setIsPrimaryContact(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <span>Designate as primary school contact for this academic year</span>
            </label>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !firstName.trim() || !lastName.trim()}
              className={primaryBtn}
            >
              <FiLink className="w-3.5 h-3.5" />
              {isSubmitting ? 'Generating...' : 'Generate Manager Invite Link'}
            </button>
          </div>
        </form>
      </div>

      {/* Recent & Pending Manager Invites List */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Manager Invites ({invites.length})
        </h3>

        {invites.length === 0 ? (
          <div className="rounded-xl bg-surface-sunken/60 p-4 text-center text-sm text-foreground-secondary">
            No manager invites generated yet for this school.
          </div>
        ) : (
          <div className="admin-stagger divide-y divide-line/50 overflow-hidden rounded-xl bg-surface-sunken/60">
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
                        className={`inline-flex h-5 items-center rounded-md px-2 text-xs font-medium capitalize ${statusColor}`}
                      >
                        {isExpired && inv.status === 'pending' ? 'Expired' : inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-secondary">
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
                        className={adminButton('ghost', 'sm') + ' text-red-300 hover:text-red-200 hover:bg-red-950/40'}
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
