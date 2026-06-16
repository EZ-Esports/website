'use client';

import { useState, useTransition } from 'react';
import { inviteAdmin } from '@/app/(admin)/admin/team/actions';

export default function InviteAdminForm({ canGrantSuperAdmin }: { canGrantSuperAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setLink(null);
    setCopied(false);
    startTransition(async () => {
      const result = await inviteAdmin(formData);
      if (!result.success || !result.token) {
        setError(result.error ?? 'Could not create invite. Please try again.');
        return;
      }
      setInvitedEmail(result.email ?? null);
      setLink(`${window.location.origin}/accept-invite?token=${result.token}`);
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — user can select manually.
    }
  }

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label htmlFor="invite-email" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="new.admin@ezesports.org"
            className="w-full px-4 py-2.5 bg-background border border-custom-border/80 rounded-lg text-foreground placeholder-foreground-secondary/40 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all"
          />
        </div>

        {canGrantSuperAdmin && (
          <div>
            <label htmlFor="invite-role" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              defaultValue="admin"
              className="px-4 py-2.5 bg-background border border-custom-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ez-pink focus:border-transparent transition-all cursor-pointer"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super-admin</option>
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="px-6 py-2.5 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-semibold rounded-lg shadow-lg hover:shadow-ez-pink/20 focus:outline-none focus:ring-2 focus:ring-ez-pink transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isPending ? 'Generating…' : 'Generate invite link'}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {link && (
        <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-4 space-y-2">
          <p className="text-sm text-green-300">
            Invite link for <span className="font-semibold">{invitedEmail}</span> — copy and send it now. It
            won&apos;t be shown again.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 px-3 py-2 bg-background border border-custom-border/80 rounded-lg text-foreground text-xs font-mono"
            />
            <button
              type="button"
              onClick={copyLink}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-lg border border-custom-border/80 transition-all cursor-pointer whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
